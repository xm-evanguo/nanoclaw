# NanoClaw Codex + Docker Migration Plan

## Goal
Migrate NanoClaw to run on **Codex in Docker only**, and explicitly drop support for:
- Claude/Anthropic runtime and auth
- macOS/launchd/Apple Container

## Scope Assumptions
- Target host platform: Linux (Docker runtime).
- Keep existing product behavior (WhatsApp I/O, scheduling, per-group isolation, IPC) unless required by Codex integration changes.
- Keep migration incremental so the app can be verified at each phase.

## Current-State Review (Key Findings)
1. **Hard Claude SDK dependency in container agent runtime**
   - `container/agent-runner/src/index.ts`
   - `container/agent-runner/package.json`
2. **Claude-specific auth and session/memory model in host runtime**
   - `src/container-runner.ts` (reads `CLAUDE_CODE_OAUTH_TOKEN`/`ANTHROPIC_API_KEY`, mounts `.claude`)
3. **Container image installs Claude tooling**
   - `container/Dockerfile` (`@anthropic-ai/claude-code`)
4. **Setup path is multi-platform and includes macOS/Apple Container branches**
   - `setup/platform.ts`, `setup/container.ts`, `setup/service.ts`, `setup/verify.ts`, `setup.sh`
5. **User/developer docs and skills are Claude-first and include Apple/macOS workflows**
   - `README.md`, `CLAUDE.md`, `docs/*`, `.claude/skills/*`
6. **Residual macOS coupling in runtime UX**
   - `src/channels/whatsapp.ts` uses `osascript` notification path and Claude wording

## Implementation Phases

## Phase 0: Codex Runtime Contract Spike
1. Build a minimal PoC in `container/agent-runner` to validate Codex non-interactive execution inside Docker.
2. Confirm required runtime primitives:
   - streamed output callbacks
   - session continuation/resume
   - tool availability needed by NanoClaw (Bash/files/web/MCP)
3. Finalize Codex env contract (e.g., `OPENAI_API_KEY`, model var, optional base URL).

### Exit Criteria
- A test container run can accept prompt input and emit structured output with session metadata.

## Phase 1: Replace Claude Agent Runtime with Codex Runtime
1. Rework `container/agent-runner/src/index.ts` to use Codex runtime contract from Phase 0.
2. Keep current host/container IPC protocol (`OUTPUT_START/END` markers) to avoid broad host rewrites.
3. Update dependencies in `container/agent-runner/package.json` and lockfile.
4. Update `container/Dockerfile` to install Codex tooling (remove Claude CLI dependency).
5. Replace secret handling in host runner:
   - `src/container-runner.ts`: remove Anthropic keys, read Codex/OpenAI keys.
6. Replace `.claude` session mount assumptions with Codex-compatible layout (`.codex` or neutral runtime session path).

### Exit Criteria
- End-to-end host -> container -> agent -> response loop works with Codex in Docker.
- Session continuity works across at least two messages in same group.

## Phase 2: Remove macOS and Apple Container Support
1. Simplify setup platform model to Linux-focused behavior:
   - `setup/platform.ts`: remove `macos`, `launchd`, `open` browser branches.
2. Simplify container setup:
   - `setup/container.ts`: Docker-only runtime acceptance.
3. Simplify service setup:
   - `setup/service.ts`: systemd + nohup fallback only.
4. Simplify verification checks:
   - `setup/verify.ts`: remove launchd/apple-container checks.
5. Remove obsolete macOS artifacts and references:
   - `launchd/`
   - Apple-container conversion paths/docs/skills.
6. Clean runtime macOS UX remnants:
   - remove `osascript` notifications and update user messages.

### Exit Criteria
- Setup completes on Linux with Docker only.
- No remaining runtime code path depends on macOS or Apple Container.

## Phase 3: Migrate Memory/Instruction Conventions from Claude to Codex
1. Introduce Codex-native instruction files (`AGENTS.md`) for project/global/group contexts.
2. Migrate existing `CLAUDE.md` content to new files and update loading behavior.
3. Add one-time migration script for existing installations to preserve user memory files.
4. Remove direct references to Claude-only features (Claude settings env vars, Claude auto-memory flags).

### Exit Criteria
- Agent receives equivalent global + group context under Codex runtime.
- Existing installations can migrate without losing memory files.

## Phase 4: Docs, Skills, and Test Suite Realignment
1. Rewrite user docs for Codex+Docker baseline:
   - `README.md`, `docs/REQUIREMENTS.md`, `docs/SPEC.md`, `docs/SECURITY.md`, `docs/DEBUG_CHECKLIST.md`.
2. Replace `CLAUDE.md` developer guide with Codex-oriented guide.
3. Handle `.claude/skills`:
   - remove from baseline or port only essential workflows (`setup`, `debug`, `update`) to Codex-compatible equivalents.
4. Update tests:
   - runtime tests for new auth/session paths
   - setup tests for Linux-only paths
   - remove Apple/macOS-specific expectations.

### Exit Criteria
- `npm run build` and `npm test` pass.
- Docs and setup instructions match actual runtime behavior.

## Phase 5: Cutover Validation
1. Fresh install validation on clean Linux host.
2. Upgrade-path validation from current Claude-based install.
3. Functional smoke tests:
   - WhatsApp auth and message round-trip
   - trigger handling and routing
   - scheduled task execution
   - group isolation and mount security
4. Failure-mode tests:
   - Docker unavailable
   - invalid/missing API key
   - container crash/restart behavior.

### Exit Criteria
- Migration release checklist passes on fresh and upgrade scenarios.

## Risks and Mitigations
1. **Codex runtime feature mismatch vs current Claude SDK behavior**
   - Mitigation: Phase 0 PoC before broad refactor.
2. **Session/memory regression during `.claude` -> new layout migration**
   - Mitigation: backward-compatible reader + one-time migration script.
3. **Setup drift from actual runtime requirements**
   - Mitigation: keep setup changes in same PR wave as runtime changes; validate with fresh install CI.
4. **Large docs/skills churn causing partial stale guidance**
   - Mitigation: explicit docs checklist and grep gate for banned terms (`launchd`, `apple-container`, `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`).

## Suggested PR Breakdown
1. PR1: Codex runtime spike + design doc.
2. PR2: Agent runner + Docker image migration to Codex.
3. PR3: Host runtime secret/session migration.
4. PR4: Linux/Docker-only setup simplification.
5. PR5: Memory/instruction file migration (`AGENTS.md`) + compatibility script.
6. PR6: Docs, skills cleanup, and test updates.

## Completion Notes (2026-02-26)

### Closed Blocking Issues
1. Codex turn parsing now treats `turn.failed` and fatal `error` events as failures even when process exit code is `0`, and never returns raw JSON event logs as user content.
2. Setup verification now gates on Docker readiness and requires `CODEX_API_KEY` or `OPENAI_API_KEY`; model/base URL/org are optional modifiers only.
3. Migration flow now handles mixed-state upgrades where destination `AGENTS.md` already exists and legacy `CLAUDE.md` has custom content, preserving user instructions with idempotent merge behavior.
4. Setup registration updates AGENTS/CLAUDE targets independently to avoid stale assistant names in mixed file states.
5. Codex event parsing now uses deterministic assistant-content precedence: finalized assistant message/response content supersedes deltas to avoid duplicate output.
6. Container runtime secret passthrough now includes `CODEX_MODEL` for end-to-end model selection.

### Remaining Validation Limits
1. Full `npm run build` / `npm test` remains blocked in this environment by network/package-install issues (`registry.npmjs.org` resolution failures and npm internal exit-handler errors).
2. Only local/offline subsets were validated where dependencies were already available; full integration validation requires a network-enabled environment with successful dependency install.
