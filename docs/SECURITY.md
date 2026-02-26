# NanoClaw Security Model

## Trust Model

- Main group: trusted administrative channel
- Non-main groups: untrusted input surface
- Host process: trusted policy enforcement point
- Container agent: sandboxed executor

## Primary Boundary: Docker Isolation

Agents run in Docker containers with explicit bind mounts. This is the core security boundary.

Controls:

- Non-root container user
- Explicit mount list per invocation
- Per-group IPC namespace
- Read-only project mount where applicable

## Mount Security

Additional mounts are validated against an external allowlist at:

- `~/.config/nanoclaw/mount-allowlist.json`

This allowlist is outside the project and never mounted into containers.

Validation includes:

- blocked pattern checks
- symlink resolution
- container path sanitization
- non-main read-only enforcement when configured

## Session and Data Isolation

Per-group runtime/session data:

- `data/sessions/<group>/.codex`

Groups cannot access each other's session directories through default mounts.

## IPC Authorization

Host validates IPC operations against group privileges:

- main can operate across groups
- non-main can only operate on own group scope

This applies to message send, task management, and registration operations.

## Credential Exposure Policy

Only these keys are passed to container runtime:

- `CODEX_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_ORG_ID`

Other `.env` variables are not forwarded to agent runtime.

## Residual Risk

Agents can still read credentials that are intentionally forwarded for runtime auth. Treat any mounted or forwarded secret as visible to in-container tools.
