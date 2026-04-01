# Koduck Agent

程序化调用多平台 LLM API 的统一接口 - 支持 MiniMax / DeepSeek / OpenAI

## 功能

- **多平台支持**: MiniMax, DeepSeek, OpenAI
- **统一接口**: OpenAI 兼容的 REST API
- **自动重试**: 内置指数退避重试机制
- **流式输出**: 支持 SSE 流式响应
- **Skill 工具调用**: 内置量化工具 + 自动发现 `.github/skills/*/SKILL.md` 中可执行 skill

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

# 量化工具直接读取 kline_data 的数据库连接（可选）
# 未设置时会回退到 MEMORY_DATABASE_URL
export KODUCK_KLINE_DATABASE_URL=postgresql://koduck:koduck@postgresql:5432/koduck_dev
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

## API 端点

- `GET /health` - 健康检查
- `GET /v1/models` - 列出可用模型
- `POST /v1/chat/completions` - 聊天补全

## 支持的模型

### MiniMax
- MiniMax-M2.7
- MiniMax-Text-01

### DeepSeek
- deepseek-chat
- deepseek-reasoner

### OpenAI
- gpt-4o-mini
- gpt-4o

## OpenClaw Skill 管理

当前支持通过 CLI 手动选择市场 skill 安装/卸载：

```bash
# 查看市场可用 skill
python3 scripts/skills.py --base-url https://your-openclaw-market market-list

# 安装一个 skill
python3 scripts/skills.py --base-url https://your-openclaw-market install --skill-id news-search

# 查看已安装 skill（来自 lockfile）
python3 scripts/skills.py installed

# 卸载 skill
python3 scripts/skills.py uninstall --skill-id news-search

# 校验 lockfile 里记录的安装文件是否存在
python3 scripts/skills.py verify
```

说明：
- 已安装市场 skill 会写入 `skills.lock`，agent 运行时只加载 lockfile 中的市场 skill。
- 调用时仍需在请求里开启 `runtimeOptions.allowRestrictedTools=true` 与 `runtimeOptions.allowMarketSkills=true`。
