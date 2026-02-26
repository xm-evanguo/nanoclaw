interface JsonObject {
  [key: string]: unknown;
}

export interface ParsedCodexTurn {
  ok: boolean;
  assistantText: string | null;
  sessionId?: string;
  error?: string;
}

const SESSION_ID_KEYS = new Set(['session_id', 'thread_id', 'conversation_id']);
const NON_FATAL_ERROR_PATTERNS = [/^Reconnecting\.\.\./i];

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function jsonLines(input: string): JsonObject[] {
  const events: JsonObject[] = [];
  for (const line of input.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (isObject(parsed)) {
        events.push(parsed);
      }
    } catch {
      // Ignore non-JSON lines.
    }
  }
  return events;
}

function findStringValue(value: unknown, keys: ReadonlySet<string>): string | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }

    for (const [k, v] of Object.entries(current)) {
      if (keys.has(k) && typeof v === 'string' && v) return v;
      if (v && typeof v === 'object') stack.push(v);
    }
  }

  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readEventType(event: JsonObject): string {
  return typeof event.type === 'string' ? event.type : '';
}

function readEventMessage(event: JsonObject): string | undefined {
  if (typeof event.message === 'string' && event.message.trim().length > 0) {
    return event.message;
  }

  if (isObject(event.error) && typeof event.error.message === 'string') {
    return event.error.message;
  }

  if (isObject(event.payload) && typeof event.payload.message === 'string') {
    return event.payload.message;
  }

  return undefined;
}

function isFatalErrorEvent(event: JsonObject): string | undefined {
  const type = readEventType(event);

  if (type === 'turn.failed') {
    return readEventMessage(event) || 'Codex reported turn.failed';
  }

  if (type === 'error') {
    const message = readEventMessage(event) || 'Codex emitted error event';
    if (NON_FATAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
      return undefined;
    }
    return message;
  }

  if (type === 'turn.cancelled') {
    return readEventMessage(event) || 'Codex turn was cancelled';
  }

  return undefined;
}

function didTurnComplete(event: JsonObject): boolean {
  const type = readEventType(event);
  if (type === 'turn.completed') return true;

  if (type === 'turn.ended' && typeof event.status === 'string') {
    const status = event.status.toLowerCase();
    return status === 'completed' || status === 'success';
  }

  if (isObject(event.turn) && typeof event.turn.status === 'string') {
    const status = event.turn.status.toLowerCase();
    return status === 'completed' || status === 'success';
  }

  return false;
}

function textFromContent(content: unknown): string[] {
  if (!Array.isArray(content)) return [];

  const parts: string[] = [];
  for (const item of content) {
    if (!isObject(item)) continue;

    if (item.type === 'output_text' || item.type === 'text') {
      const text = asString(item.text);
      if (text) parts.push(text);
    }

    if (Array.isArray(item.content)) {
      parts.push(...textFromContent(item.content));
    }
  }

  return parts;
}

function assistantTextFromResponseItem(event: JsonObject): string[] {
  if (readEventType(event) !== 'response_item') return [];
  if (!isObject(event.payload)) return [];

  const payload = event.payload;
  if (payload.type !== 'message' || payload.role !== 'assistant') {
    return [];
  }

  return textFromContent(payload.content);
}

function extractFinalAssistantText(event: JsonObject): string[] {
  const type = readEventType(event);

  const responseItemText = assistantTextFromResponseItem(event);
  if (responseItemText.length > 0) return responseItemText;

  if ((type === 'message' || type === 'assistant.message') && event.role === 'assistant') {
    return textFromContent(event.content);
  }

  return [];
}

function extractDeltaAssistantText(event: JsonObject): string[] {
  const type = readEventType(event);

  const directTextEvents = new Set([
    'response.output_text.delta',
    'response.output_text.done',
    'turn.output_text.delta',
    'turn.output_text.done',
  ]);

  if (directTextEvents.has(type)) {
    const text = asString(event.delta) || asString(event.text);
    return text ? [text] : [];
  }

  if (type === 'assistant' || type === 'assistant.delta') {
    const text = asString(event.text) || asString(event.delta);
    return text ? [text] : [];
  }

  return [];
}

export function parseCodexTurnOutput(stdout: string): ParsedCodexTurn {
  const events = jsonLines(stdout);

  let sessionId: string | undefined;
  let completed = false;
  let fatalError: string | undefined;
  const deltaTextParts: string[] = [];
  const finalTextParts: string[] = [];

  for (const event of events) {
    sessionId ||= findStringValue(event, SESSION_ID_KEYS);

    if (!fatalError) {
      fatalError = isFatalErrorEvent(event);
    }

    if (!completed) {
      completed = didTurnComplete(event);
    }

    finalTextParts.push(...extractFinalAssistantText(event));
    deltaTextParts.push(...extractDeltaAssistantText(event));
  }

  if (fatalError) {
    return {
      ok: false,
      assistantText: null,
      sessionId,
      error: fatalError,
    };
  }

  if (!completed) {
    return {
      ok: false,
      assistantText: null,
      sessionId,
      error: 'Codex turn did not report successful completion',
    };
  }

  // Deterministic precedence: finalized assistant messages supersede deltas.
  const chosenTextParts = finalTextParts.length > 0 ? finalTextParts : deltaTextParts;
  const assistantText = chosenTextParts.join('').replace(/\r\n/g, '\n').trim();
  return {
    ok: true,
    assistantText: assistantText.length > 0 ? assistantText : null,
    sessionId,
  };
}
