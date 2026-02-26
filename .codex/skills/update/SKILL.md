---
name: update
description: Fetch upstream NanoClaw core and prepare merge/update workflow.
---

# NanoClaw Update Workflow

## 1) Fetch upstream snapshot

```bash
./.codex/skills/update/scripts/fetch-upstream.sh
```

This script writes a status block including:

- `CURRENT_VERSION`
- `NEW_VERSION`
- `TEMP_DIR`
- `REMOTE`

## 2) Review extracted upstream files

Inspect the temp directory from the status output.

## 3) Merge intentionally

Use repo tooling (`skills-engine` scripts) or standard git merge/rebase workflow to integrate changes while preserving local customizations.

## 4) Validate runtime after merge

```bash
npm run build
npm test
npm run setup -- --step verify
```
