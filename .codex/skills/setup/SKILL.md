---
name: setup
description: Install and configure NanoClaw on Linux with Docker and Codex runtime.
---

# NanoClaw Setup (Codex + Docker)

Run these steps in order from repository root.

## 1) Bootstrap dependencies

```bash
./setup.sh
```

## 2) Environment check

```bash
npm run setup -- --step environment
```

## 3) Build and validate container runtime

```bash
npm run setup -- --step container --runtime docker
```

## 4) Authenticate WhatsApp

Use terminal QR:

```bash
npm run setup -- --step whatsapp-auth --method qr-terminal
```

Or browser QR:

```bash
npm run setup -- --step whatsapp-auth --method qr-browser
```

## 5) Configure service

```bash
npm run setup -- --step service
```

## 6) Final verification

```bash
npm run setup -- --step verify
```

## 7) Start runtime

```bash
npm run start
```
