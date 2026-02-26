# NanoClaw Requirements

## Product Goal

NanoClaw is a personal assistant runtime that uses Codex in Docker containers, with WhatsApp as the primary I/O channel.

## Supported Platform

- Linux host only
- Docker runtime only
- Node.js 20+

Explicitly unsupported in baseline:

- macOS service/runtime paths
- Apple Container runtime
- Claude/Anthropic runtime/auth paths

## Core Functional Requirements

- Run a single host Node.js process for routing, state, scheduler, and IPC.
- Spawn isolated container agents per group using Docker.
- Keep per-group isolation for filesystem, sessions, and IPC namespace.
- Preserve trigger behavior:
  - main group: no trigger required
  - non-main groups: trigger required unless `requiresTrigger=false`
- Support scheduled task creation, list, pause, resume, cancel.
- Support group registration and discovery from the main channel.
- Persist data in SQLite (`store/messages.db`).

## Memory and Instructions

- Instruction files are `AGENTS.md`.
- Global instructions live in `groups/global/AGENTS.md`.
- Group-specific instructions live in `groups/<group>/AGENTS.md`.
- Existing installs with `CLAUDE.md` must migrate without data loss.

## Security Requirements

- Containerized execution is the primary boundary.
- Project code mounts for agents are read-only where applicable.
- Additional mounts require allowlist validation.
- Credentials passed into container runtime must be limited to Codex/OpenAI vars only.

## Setup and Operations

Setup flow must support:

- Environment checks on Linux
- Docker build + test run
- WhatsApp authentication
- Service setup (`systemd` preferred, `nohup` fallback)
- End-to-end verification checks

## Non-Goals

- Cross-platform runtime abstraction beyond Linux + Docker.
- Legacy runtime compatibility for Claude/Anthropic.
- Baseline Apple Container conversion workflows.
