/**
 * NanoClaw Agent Runner (Codex CLI runtime)
 * Runs inside a container, receives config via stdin, outputs result to stdout.
 *
 * Input protocol:
 *   Stdin: Full ContainerInput JSON (read until EOF)
 *   IPC:   Follow-up messages written as JSON files to /workspace/ipc/input/
 *          Files: {type:"message", text:"..."}.json — polled and consumed
 *          Sentinel: /workspace/ipc/input/_close — signals session end
 *
 * Stdout protocol:
 *   Each result is wrapped in OUTPUT_START_MARKER / OUTPUT_END_MARKER pairs.
 *   Multiple results may be emitted (one per completed turn).
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { parseCodexTurnOutput } from './codex-events.js';

interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  secrets?: Record<string, string>;
}

interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

interface CodexTurnResult {
  text: string | null;
  sessionId?: string;
}

const IPC_INPUT_DIR = '/workspace/ipc/input';
const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, '_close');
const IPC_POLL_MS = 500;
const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';
const MCP_SERVER_SCRIPT = '/tmp/dist/ipc-mcp-stdio.js';

function readInstructionFile(...pathsToTry: string[]): string | null {
  for (const filePath of pathsToTry) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      if (content.length > 0) return content;
    } catch {
      // ignore and try next path
    }
  }
  return null;
}

function buildInstructionContext(input: ContainerInput): string | null {
  const groupInstructions = readInstructionFile(
    '/workspace/group/AGENTS.md',
    '/workspace/group/CLAUDE.md',
  );

  const globalInstructions = input.isMain
    ? readInstructionFile(
        '/workspace/project/groups/global/AGENTS.md',
        '/workspace/project/groups/global/CLAUDE.md',
      )
    : readInstructionFile(
        '/workspace/global/AGENTS.md',
        '/workspace/global/CLAUDE.md',
      );

  const sections: string[] = [];
  if (globalInstructions) {
    sections.push(`Global instructions:\n${globalInstructions}`);
  }
  if (groupInstructions) {
    sections.push(`Group instructions:\n${groupInstructions}`);
  }
  if (sections.length === 0) return null;

  return (
    'Use the following project instructions as high-priority context:\n\n' +
    sections.join('\n\n')
  );
}

function existingDir(dirPath: string): string | null {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
      ? dirPath
      : null;
  } catch {
    return null;
  }
}

function getCodexAddDirs(input: ContainerInput): string[] {
  const dirs = new Set<string>();
  dirs.add('/workspace/group');
  dirs.add('/workspace/ipc');

  if (input.isMain) {
    const projectDir = existingDir('/workspace/project');
    if (projectDir) dirs.add(projectDir);
  } else {
    const globalDir = existingDir('/workspace/global');
    if (globalDir) dirs.add(globalDir);
  }

  const extraRoot = '/workspace/extra';
  const extraDir = existingDir(extraRoot);
  if (extraDir) {
    for (const entry of fs.readdirSync(extraRoot)) {
      const fullPath = path.join(extraRoot, entry);
      const maybeDir = existingDir(fullPath);
      if (maybeDir) dirs.add(maybeDir);
    }
  }

  return Array.from(dirs);
}

function buildCodexConfigOverrides(input: ContainerInput): string[] {
  return [
    `mcp_servers.nanoclaw.command=${JSON.stringify('node')}`,
    `mcp_servers.nanoclaw.args=${JSON.stringify([MCP_SERVER_SCRIPT])}`,
    `mcp_servers.nanoclaw.env.NANOCLAW_CHAT_JID=${JSON.stringify(input.chatJid)}`,
    `mcp_servers.nanoclaw.env.NANOCLAW_GROUP_FOLDER=${JSON.stringify(input.groupFolder)}`,
    `mcp_servers.nanoclaw.env.NANOCLAW_IS_MAIN=${JSON.stringify(input.isMain ? '1' : '0')}`,
  ];
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

function log(message: string): void {
  console.error(`[agent-runner] ${message}`);
}

function shouldClose(): boolean {
  if (fs.existsSync(IPC_INPUT_CLOSE_SENTINEL)) {
    try {
      fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
    } catch {
      // ignore
    }
    return true;
  }
  return false;
}

function drainIpcInput(): string[] {
  try {
    fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
    const files = fs
      .readdirSync(IPC_INPUT_DIR)
      .filter(f => f.endsWith('.json'))
      .sort();

    const messages: string[] = [];
    for (const file of files) {
      const filePath = path.join(IPC_INPUT_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        fs.unlinkSync(filePath);
        if (data.type === 'message' && data.text) {
          messages.push(String(data.text));
        }
      } catch (err) {
        log(
          `Failed to process input file ${file}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }
      }
    }
    return messages;
  } catch (err) {
    log(`IPC drain error: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

function waitForIpcMessage(): Promise<string | null> {
  return new Promise(resolve => {
    const poll = () => {
      if (shouldClose()) {
        resolve(null);
        return;
      }
      const messages = drainIpcInput();
      if (messages.length > 0) {
        resolve(messages.join('\n'));
        return;
      }
      setTimeout(poll, IPC_POLL_MS);
    };
    poll();
  });
}

function buildCodexArgs(
  prompt: string,
  sessionId: string | undefined,
  input: ContainerInput,
  model?: string,
): string[] {
  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    'workspace-write',
  ];

  if (model) {
    args.push('--model', model);
  }

  for (const dir of getCodexAddDirs(input)) {
    args.push('--add-dir', dir);
  }

  for (const override of buildCodexConfigOverrides(input)) {
    args.push('--config', override);
  }

  // Use "resume" subcommand for continuing a session.
  if (sessionId) {
    args.push('resume', sessionId, prompt);
  } else {
    args.push(prompt);
  }

  return args;
}

function runCodexTurn(
  prompt: string,
  sessionId: string | undefined,
  sdkEnv: Record<string, string | undefined>,
  containerInput: ContainerInput,
): Promise<CodexTurnResult> {
  return new Promise((resolve, reject) => {
    const codexEnv: Record<string, string | undefined> = { ...sdkEnv };

    // Codex CLI expects CODEX_API_KEY; allow OPENAI_API_KEY as source of truth.
    if (!codexEnv.CODEX_API_KEY && codexEnv.OPENAI_API_KEY) {
      codexEnv.CODEX_API_KEY = codexEnv.OPENAI_API_KEY;
    }

    const model = codexEnv.CODEX_MODEL || codexEnv.OPENAI_MODEL;
    const args = buildCodexArgs(prompt, sessionId, containerInput, model);
    log(`Running: codex ${args.join(' ')}`);

    const proc = spawn('codex', args, {
      cwd: '/workspace/group',
      env: codexEnv as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', chunk => {
      const data = chunk.toString();
      stderr += data;
      const lines = data.trim().split('\n');
      for (const line of lines) {
        if (line) log(line);
      }
    });

    proc.on('error', err => {
      reject(err);
    });

    proc.on('close', code => {
      if (code !== 0) {
        reject(
          new Error(
            `codex exited with code ${code}: ${stderr.slice(-500) || 'no stderr'}`,
          ),
        );
        return;
      }

      const parsed = parseCodexTurnOutput(stdout);
      if (!parsed.ok) {
        reject(
          new Error(parsed.error || 'Codex turn failed without error message'),
        );
        return;
      }

      resolve({ text: parsed.assistantText, sessionId: parsed.sessionId });
    });
  });
}

async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    // Delete the temp file the entrypoint wrote — it contains secrets.
    try {
      fs.unlinkSync('/tmp/input.json');
    } catch {
      // ignore
    }
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${
        err instanceof Error ? err.message : String(err)
      }`,
    });
    process.exit(1);
    return;
  }

  const sdkEnv: Record<string, string | undefined> = { ...process.env };
  for (const [key, value] of Object.entries(containerInput.secrets || {})) {
    sdkEnv[key] = value;
  }

  let sessionId = containerInput.sessionId;
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
  try {
    fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
  } catch {
    // ignore stale sentinel
  }

  let prompt = containerInput.prompt;
  if (containerInput.isScheduledTask) {
    prompt =
      '[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n' +
      prompt;
  }

  const instructionContext = buildInstructionContext(containerInput);
  if (instructionContext) {
    prompt = `${instructionContext}\n\nUser request:\n${prompt}`;
  }

  const pending = drainIpcInput();
  if (pending.length > 0) {
    log(`Draining ${pending.length} pending IPC messages into initial prompt`);
    prompt += '\n' + pending.join('\n');
  }

  try {
    while (true) {
      log(`Starting turn (session: ${sessionId || 'new'})...`);

      const turn = await runCodexTurn(prompt, sessionId, sdkEnv, containerInput);
      if (turn.sessionId) {
        sessionId = turn.sessionId;
      }

      writeOutput({
        status: 'success',
        result: turn.text,
        newSessionId: sessionId,
      });

      // Session update marker for host continuity/idle tracking.
      writeOutput({ status: 'success', result: null, newSessionId: sessionId });

      log('Turn ended, waiting for next IPC message...');
      const nextMessage = await waitForIpcMessage();
      if (nextMessage === null) {
        log('Close sentinel received, exiting');
        break;
      }

      log(`Got new message (${nextMessage.length} chars), starting next turn`);
      prompt = nextMessage;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Agent error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId: sessionId,
      error: errorMessage,
    });
    process.exit(1);
  }
}

main();
