<p align="center">
  <img src="assets/nanoclaw-logo.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  A personal assistant that runs Codex agents in isolated Docker containers.
</p>

<p align="center">
  <a href="https://nanoclaw.dev">nanoclaw.dev</a>&nbsp; • &nbsp;
  <a href="README_zh.md">中文</a>&nbsp; • &nbsp;
  <a href="https://discord.gg/VDdww8qS42"><img src="https://img.shields.io/discord/1470188214710046894?label=Discord&logo=discord&v=2" alt="Discord" valign="middle"></a>&nbsp; • &nbsp;
  <a href="repo-tokens"><img src="repo-tokens/badge.svg" alt="repo tokens" valign="middle"></a>
</p>

## What NanoClaw Is

NanoClaw is a Linux + Docker runtime for a WhatsApp-connected personal assistant:

- Host: one Node.js process (`src/index.ts`) for routing, scheduler, and state
- Agent runtime: Codex CLI inside per-group Docker containers
- Memory: per-group instruction/context files (`groups/*/AGENTS.md`) plus persistent sessions
- Isolation: each group runs with explicit container mounts only

## Requirements

- Linux host
- Docker
- Node.js 20+
- A runtime auth key in `.env`: `CODEX_API_KEY` or `OPENAI_API_KEY` (required)
- Optional model/base config in `.env`:
  - `CODEX_MODEL` (supported, preferred model selector)
  - `OPENAI_MODEL` (fallback model selector)
  - `OPENAI_BASE_URL`, `OPENAI_ORG_ID` (optional modifiers)

## Quick Start

```bash
git clone https://github.com/qwibitai/NanoClaw.git
cd NanoClaw
./setup.sh
npm run setup -- --step container --runtime docker
npm run setup -- --step whatsapp-auth --method qr-terminal
npm run setup -- --step service
npm run setup -- --step verify
npm run start
```

For browser QR auth instead of terminal QR:

```bash
npm run setup -- --step whatsapp-auth --method qr-browser
```

## Core Features

- WhatsApp inbound/outbound messaging
- Per-group isolated execution with Docker mounts
- Trigger-based routing + main admin channel behavior
- Scheduled tasks with IPC-backed MCP tools
- Group discovery and registration controls

## Project Layout

- `src/`: host runtime
- `container/`: Docker image + in-container agent runner
- `groups/`: per-group instruction and working files (`AGENTS.md`)
- `setup/`: setup workflow modules
- `docs/`: requirements/spec/security/debug references

## Build and Test

```bash
npm run build
npm test
```

## Security

Read `docs/SECURITY.md` for the trust model, mount isolation, credential handling, and IPC authorization rules.

## License

MIT
