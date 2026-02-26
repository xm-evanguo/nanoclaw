# NanoClaw Specification

## Architecture

```text
WhatsApp (baileys)
  -> SQLite (messages, groups, sessions, tasks)
  -> Host loops (router + scheduler + IPC watcher)
  -> Docker container (Codex CLI agent runner)
  -> Response back to WhatsApp
```

Host runtime is a single Node.js process. Agent execution is isolated per group in Docker containers.

## Runtime Components

- `src/index.ts`: startup, polling loops, queue orchestration
- `src/channels/whatsapp.ts`: WhatsApp connection and send/receive
- `src/container-runner.ts`: container spawn, mounts, streaming output parsing
- `src/ipc.ts`: file-based IPC between host and container MCP server
- `src/task-scheduler.ts`: scheduled task executor
- `src/db.ts`: SQLite schema + queries

## Container Contract

Input to container agent runner (stdin JSON):

- `prompt`
- `sessionId` (optional)
- `groupFolder`
- `chatJid`
- `isMain`
- `isScheduledTask` (optional)
- `assistantName` (optional)
- `secrets` (host-filtered runtime credentials)

Output to host (stdout markers):

- `---NANOCLAW_OUTPUT_START---`
- JSON `ContainerOutput`
- `---NANOCLAW_OUTPUT_END---`

`ContainerOutput` fields:

- `status`: `success | error`
- `result`: `string | null`
- `newSessionId` (optional)
- `error` (optional)

## Mount Model

Standard mounts:

- `/workspace/group` (rw): current group folder
- `/workspace/project` (ro): project root, main group only
- `/workspace/global` (ro): global group folder, non-main only
- `/workspace/ipc` (rw): per-group IPC namespace
- `/home/node/.codex` (rw): per-group Codex runtime/session state
- `/workspace/extra/*`: validated additional mounts

## Session and Memory

- Session IDs are persisted per group in SQLite.
- Runtime state is persisted at `data/sessions/<group>/.codex`.
- Instruction files are `AGENTS.md` in group folders.
- One-time migration copies legacy `CLAUDE.md` and `.claude` state where needed.

## Setup Steps

Setup modules in `setup/`:

1. `environment`
2. `container`
3. `whatsapp-auth`
4. `groups`
5. `register`
6. `mounts`
7. `service`
8. `verify`

Platform expectations:

- Linux only
- Docker only
- Service manager: systemd preferred, nohup fallback

## Credentials

Allowed runtime credential keys:

- `CODEX_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_ORG_ID`

At least one auth key is required: `CODEX_API_KEY` or `OPENAI_API_KEY`.

No Anthropic/Claude credential paths are part of baseline runtime behavior.
