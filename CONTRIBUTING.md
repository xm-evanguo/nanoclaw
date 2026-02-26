# Contributing to NanoClaw

NanoClaw baseline is intentionally minimal and Linux+Docker-only.

## What We Accept in Baseline

- Security fixes
- Bug fixes
- Clear reliability/performance improvements
- Docs that match actual runtime behavior

## Skills Contributions

If you want to add optional capabilities, contribute skills instead of expanding baseline runtime scope.

- Preferred skill location: `.codex/skills/`
- Keep skills self-contained and auditable
- Avoid re-introducing unsupported baseline targets (macOS runtime, Apple Container, Anthropic-specific auth/runtime)

## Development

```bash
npm run build
npm test
```

Include tests for behavior changes and keep changes focused.
