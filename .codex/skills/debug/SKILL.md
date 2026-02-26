---
name: debug
description: Diagnose NanoClaw runtime issues on Linux Docker installs.
---

# NanoClaw Debug

Run these checks from repository root.

## 1) Service and logs

```bash
systemctl --user status nanoclaw --no-pager

tail -n 200 logs/nanoclaw.log
tail -n 200 logs/nanoclaw.error.log
```

## 2) Docker and containers

```bash
docker info

docker ps --filter name=nanoclaw- --format '{{.Names}} {{.Status}}'
```

## 3) DB and registration state

```bash
sqlite3 store/messages.db 'SELECT jid, name, folder, requires_trigger FROM registered_groups;'
sqlite3 store/messages.db 'SELECT id, group_folder, status, next_run FROM scheduled_tasks ORDER BY next_run;'
```

## 4) Session state

```bash
find data/sessions -maxdepth 3 -type d -name '.codex'
```

## 5) Common fixes

- Rebuild container image: `npm run setup -- --step container --runtime docker`
- Re-run verification: `npm run setup -- --step verify`
- If auth expired: `npm run setup -- --step whatsapp-auth --method qr-terminal`
