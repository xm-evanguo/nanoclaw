# NanoClaw

Personal Codex assistant runtime. See `README.md` for setup and `docs/REQUIREMENTS.md` for architecture.

## Runtime Overview

- Single Node.js host process (`src/index.ts`) handling WhatsApp I/O, routing, scheduler, and IPC.
- Per-group container execution via Docker with filesystem isolation.
- Container agent runtime uses Codex CLI (`container/agent-runner/src/index.ts`).
- Group/global instructions are `AGENTS.md` files in `groups/*`.

## Core Files

- `src/index.ts`: startup, loops, channel wiring, and queue orchestration.
- `src/container-runner.ts`: container spawn, mounts, session persistence, streaming parsing.
- `src/channels/whatsapp.ts`: WhatsApp connect/send/receive + group sync.
- `src/ipc.ts`: IPC commands from container MCP to host.
- `src/task-scheduler.ts`: scheduled task execution.
- `src/db.ts`: SQLite schema and queries.

## Development Commands

- `npm run dev`: run with `tsx`.
- `npm run build`: compile TypeScript.
- `npm test`: run vitest suite.
- `./container/build.sh`: rebuild agent container image.

## Service Management (Linux)

- `systemctl --user start nanoclaw`
- `systemctl --user stop nanoclaw`
- `systemctl --user restart nanoclaw`
