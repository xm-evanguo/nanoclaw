# NanoClaw Debug Checklist

## Quick Health Checks

```bash
# 1) Service status (user service)
systemctl --user status nanoclaw --no-pager

# 2) Host logs
tail -n 200 logs/nanoclaw.log

tail -n 200 logs/nanoclaw.error.log

# 3) Running NanoClaw containers
docker ps --filter name=nanoclaw- --format '{{.Names}} {{.Status}}'

# 4) Recent container logs (per-group)
ls -lt groups/*/logs/container-*.log | head
```

## Runtime and Credentials

```bash
# Docker reachability
docker info >/dev/null && echo "docker ok"

# Credential keys present in .env
rg -n '^(CODEX_API_KEY|OPENAI_API_KEY|OPENAI_BASE_URL|OPENAI_MODEL|OPENAI_ORG_ID)=' .env
```

## Database Sanity

```bash
# Registered groups
sqlite3 store/messages.db 'SELECT jid, name, folder, requires_trigger FROM registered_groups;'

# Active tasks
sqlite3 store/messages.db 'SELECT id, group_folder, status, next_run FROM scheduled_tasks ORDER BY next_run;'

# Session mapping
sqlite3 store/messages.db 'SELECT group_folder, session_id FROM sessions;'
```

## Session State

```bash
# Per-group Codex runtime state
find data/sessions -maxdepth 3 -type d -name '.codex'
```

## Message Flow Checks

```bash
# Inbound message ingestion
grep -E 'New messages|Processing messages' logs/nanoclaw.log | tail -20

# Container spawn/timeout behavior
grep -E 'Spawning container agent|Container timeout|Container completed' logs/nanoclaw.log | tail -30
```

## Common Failure Modes

- Docker unavailable: `setup/container` and runtime agent spawn fail.
- Missing API key: container runner starts but Codex invocation fails.
- Stale service env/group membership: Docker works in shell but not in systemd session.
- Session corruption: remove only the affected `data/sessions/<group>/.codex` after backup.
