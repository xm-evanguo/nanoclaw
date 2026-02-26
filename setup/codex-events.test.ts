import { describe, expect, it } from 'vitest';

import { parseCodexTurnOutput } from '../container/agent-runner/src/codex-events.js';

function lines(events: Array<Record<string, unknown>>): string {
  return events.map((e) => JSON.stringify(e)).join('\n');
}

describe('parseCodexTurnOutput', () => {
  it('returns assistant text only when turn completes successfully', () => {
    const output = lines([
      { type: 'thread.started', thread_id: 'thread-1' },
      { type: 'turn.started' },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hello from Codex' }],
        },
      },
      { type: 'turn.completed' },
    ]);

    const parsed = parseCodexTurnOutput(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.sessionId).toBe('thread-1');
    expect(parsed.assistantText).toBe('Hello from Codex');
  });

  it('prefers finalized assistant message content over streamed deltas', () => {
    const output = lines([
      { type: 'turn.started' },
      { type: 'response.output_text.delta', delta: 'Hello ' },
      { type: 'response.output_text.delta', delta: 'from delta' },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Hello from finalized message' }],
        },
      },
      { type: 'turn.completed' },
    ]);

    const parsed = parseCodexTurnOutput(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.assistantText).toBe('Hello from finalized message');
  });

  it('falls back to delta content when finalized message content is absent', () => {
    const output = lines([
      { type: 'turn.started' },
      { type: 'response.output_text.delta', delta: 'Hello ' },
      { type: 'response.output_text.delta', delta: 'from deltas' },
      { type: 'turn.completed' },
    ]);

    const parsed = parseCodexTurnOutput(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.assistantText).toBe('Hello from deltas');
  });

  it('fails on turn.failed even if process output includes assistant text', () => {
    const output = lines([
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'partial output' }],
        },
      },
      { type: 'turn.failed', error: { message: 'model failure' } },
      { type: 'turn.completed' },
    ]);

    const parsed = parseCodexTurnOutput(output);
    expect(parsed.ok).toBe(false);
    expect(parsed.assistantText).toBeNull();
    expect(parsed.error).toContain('model failure');
  });

  it('fails on fatal error events', () => {
    const output = lines([
      { type: 'thread.started', thread_id: 'thread-2' },
      { type: 'turn.started' },
      { type: 'error', message: 'authentication failed' },
      { type: 'turn.completed' },
    ]);

    const parsed = parseCodexTurnOutput(output);
    expect(parsed.ok).toBe(false);
    expect(parsed.sessionId).toBe('thread-2');
    expect(parsed.error).toContain('authentication failed');
  });

  it('ignores transient reconnect error events when turn completes', () => {
    const output = lines([
      { type: 'turn.started' },
      { type: 'error', message: 'Reconnecting... 1/5 (stream disconnected)' },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Recovered response' }],
        },
      },
      { type: 'turn.completed' },
    ]);

    const parsed = parseCodexTurnOutput(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.assistantText).toBe('Recovered response');
  });

  it('fails when completion status is missing and never returns raw event logs', () => {
    const output = lines([
      { type: 'thread.started', thread_id: 'thread-3' },
      { type: 'turn.started' },
      { type: 'response_item', payload: { type: 'reasoning', summary: [] } },
    ]);

    const parsed = parseCodexTurnOutput(output);
    expect(parsed.ok).toBe(false);
    expect(parsed.assistantText).toBeNull();
    expect(parsed.error).toContain('did not report successful completion');
  });
});
