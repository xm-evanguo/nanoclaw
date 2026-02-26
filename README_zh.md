<p align="center">
  <img src="assets/nanoclaw-logo.png" alt="NanoClaw" width="400">
</p>

<p align="center">
  NanoClaw：在 Docker 隔离容器中运行 Codex 智能体的个人助手。
</p>

## 项目说明

NanoClaw 是一个 Linux + Docker 方案：

- 主进程：单个 Node.js 进程（消息路由、调度、状态管理）
- 智能体：容器内运行 Codex CLI
- 记忆：按群组隔离，使用 `groups/*/AGENTS.md`
- 安全：仅挂载白名单路径，按群组隔离会话与 IPC

## 运行要求

- Linux
- Docker
- Node.js 20+
- `.env` 中配置 `OPENAI_API_KEY` 或 `CODEX_API_KEY`

## 快速开始

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

如需浏览器扫码认证：

```bash
npm run setup -- --step whatsapp-auth --method qr-browser
```

## 核心能力

- WhatsApp 收发消息
- 群组级隔离执行
- 定时任务（创建/暂停/恢复/取消）
- 主群组管理能力（注册群组、查看任务）

## 构建与测试

```bash
npm run build
npm test
```

## 安全模型

详见 `docs/SECURITY.md`。
