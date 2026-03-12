# Koduck Agent

程序化调用多平台 LLM API 的统一接口 - 支持 MiniMax / DeepSeek / OpenAI

## 功能

- **多平台支持**: MiniMax, DeepSeek, OpenAI
- **统一接口**: OpenAI 兼容的 REST API
- **自动重试**: 内置指数退避重试机制
- **流式输出**: 支持 SSE 流式响应
- **Skill 工具调用**: 内置工具 + 自动发现 `.github/skills/*/SKILL.md` 中可执行 skill

## 快速开始

### 环境变量

```bash
# 选择 LLM 提供商 (minimax/deepseek/openai)
export LLM_PROVIDER=minimax

# API 密钥 (支持 provider 特定密钥)
export MINIMAX_API_KEY=your_minimax_api_key
export DEEPSEEK_API_KEY=your_deepseek_api_key
export OPENAI_API_KEY=your_openai_api_key

# 或通用密钥
export LLM_API_KEY=your_api_key
```

### Docker 启动

```bash
docker-compose up -d agent
```

### API 调用

```bash
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "deepseek",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### QQ Bot Skill 配置（由后端/前端透传）

`/v1/chat/completions` 与 `/api/v1/ai/chat` 请求体可选 `qqBot` 字段：

```json
{
  "provider": "minimax",
  "qqBot": {
    "enabled": true,
    "appId": "102001",
    "clientSecret": "qq_client_secret",
    "apiBase": "https://api.sgroup.qq.com",
    "tokenPath": "/app/getAppAccessToken",
    "sendUrlTemplate": "/v2/groups/{target_id}/messages",
    "defaultTargetId": "group_openid",
    "targetPlaceholder": "target_id",
    "contentField": "content",
    "msgType": 0,
    "tokenTtlBufferSeconds": 60
  },
  "messages": [{"role": "user", "content": "请发送“你好”给 QQ 群机器人"}]
}
```

## API 端点

- `GET /health` - 健康检查
- `GET /v1/models` - 列出可用模型
- `POST /v1/chat/completions` - 聊天补全

## 支持的模型

### MiniMax
- MiniMax-M2.5
- MiniMax-Text-01

### DeepSeek
- deepseek-chat
- deepseek-reasoner

### OpenAI
- gpt-4o-mini
- gpt-4o
