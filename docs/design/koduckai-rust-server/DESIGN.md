# KoduckAI Rust Server 设计文档

## 1. 概述

### 1.1 目标

将现有的 `koduck-backend/koduck-ai`（Java/Spring Boot）和 `koduck-agent`（Python/FastAPI）统一迁移为单个 Rust 服务（`koduck-ai-server`），为前端提供完整的 AI 对话、流式响应、工具调用和记忆管理能力。

### 1.2 现状分析

当前 AI 功能分散在两个服务中：

| 服务 | 技术栈 | 提供能力 | 状态 |
|------|--------|----------|------|
| `koduck-backend/koduck-ai` | Java / Spring Boot | 组合分析（规则引擎）、风险评分、数据库 Schema 定义 | 已实现（无 LLM 集成） |
| `koduck-agent` | Python / FastAPI | LLM 对话、SSE 流式、工具调用、记忆系统 | 已实现（生产运行） |

**核心问题**：Java 模块定义了数据模型但没有 LLM 能力，Python 模块有完整的 AI 能力但作为独立服务存在。需要合并为统一的高性能 Rust 服务。

### 1.3 设计原则

- **API 兼容**：保持与前端现有接口完全兼容，无需前端改动
- **遵循 `koduck-auth` Rust 架构**：复用已有的分层架构、配置模式、错误处理、中间件等约定
- **高性能**：利用 Rust 的异步 I/O 和零成本抽象，提供低延迟、高吞吐的 AI 服务
- **多 LLM 提供商**：统一抽象 OpenAI / Anthropic / DeepSeek / MiniMax 等提供商

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────┐     ┌──────────────────────────────────────────────────┐
│   Frontend   │────▶│              koduck-ai-server (Rust)             │
│  (koduck-    │ SSE │                                                  │
│  frontend)   │◀────│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │
└─────────────┘     │  │  HTTP   │ │  gRPC    │ │  WebSocket       │  │
                    │  │  Routes │ │  Service │ │  (STOMP)         │  │
                    │  └────┬────┘ └────┬─────┘ └───────┬──────────┘  │
                    │       │           │               │              │
                    │  ┌────▼───────────▼───────────────▼──────────┐   │
                    │  │              Middleware                    │   │
                    │  │  (Auth · Logging · RateLimit · Trace)     │   │
                    │  └────────────────────┬──────────────────────┘   │
                    │  ┌────────────────────▼──────────────────────┐   │
                    │  │            Service Layer                    │   │
                    │  │  ┌──────────┐ ┌───────────┐ ┌───────────┐ │   │
                    │  │  │ ChatSvc  │ │ MemorySvc │ │ AnalysisSvc│ │   │
                    │  │  └────┬─────┘ └─────┬─────┘ └─────┬─────┘ │   │
                    │  │  ┌────▼─────┐ ┌─────▼─────┐           │    │   │
                    │  │  │ ToolSvc  │ │ LLMClient │           │    │   │
                    │  │  └──────────┘ └───────────┘           │    │   │
                    │  └────────────────────┬──────────────────────┘   │
                    │  ┌────────────────────▼──────────────────────┐   │
                    │  │           Repository Layer                  │   │
                    │  │  (PostgreSQL · Redis)                      │   │
                    │  └────────────────────────────────────────────┘   │
                    └──────────────────────────────────────────────────┘
                                               │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                        ┌──────────┐   ┌──────────┐   ┌──────────────┐
                        │PostgreSQL│   │  Redis   │   │ LLM APIs     │
                        │          │   │          │   │ (OpenAI/      │
                        │ Chat DB  │   │ Cache    │   │  Anthropic/  │
                        │ Memory   │   │ RateLimit│   │  DeepSeek/   │
                        │ Portfolio│   │ Session  │   │  MiniMax)    │
                        └──────────┘   └──────────┘   └──────────────┘
```

### 2.2 项目结构

```
koduck-ai-server/
├── Cargo.toml
├── Dockerfile
├── config/
│   └── default.toml                # 默认配置
├── migrations/                     # sqlx 数据库迁移
│   ├── 001_create_chat_tables.sql
│   └── 002_create_memory_tables.sql
├── proto/                          # gRPC 服务定义
│   └── ai_service.proto
├── src/
│   ├── main.rs                     # 入口 + 优雅关闭
│   ├── lib.rs                      # 库导出
│   ├── config.rs                   # 配置管理（对齐 koduck-auth 模式）
│   ├── error.rs                    # 错误类型（对齐 koduck-auth 模式）
│   ├── state.rs                    # 共享应用状态
│   │
│   ├── model/                      # 数据模型
│   │   ├── mod.rs
│   │   ├── chat.rs                 # ChatSession, ChatMessage
│   │   ├── memory.rs               # MemoryL1Summary, MemoryL2Theme
│   │   ├── llm.rs                  # LLM 请求/响应 DTO
│   │   └── analysis.rs             # Portfolio 分析模型
│   │
│   ├── repository/                 # 数据访问层
│   │   ├── mod.rs
│   │   ├── chat_repository.rs      # 会话 & 消息 CRUD
│   │   ├── memory_repository.rs    # L1/L2 记忆读写
│   │   └── analysis_repository.rs  # 组合分析数据查询
│   │
│   ├── service/                    # 业务逻辑层
│   │   ├── mod.rs
│   │   ├── chat_service.rs         # 对话编排（核心）
│   │   ├── memory_service.rs       # L1/L2 记忆管理
│   │   ├── analysis_service.rs     # 组合分析（风险/收益/优化）
│   │   └── context_service.rs      # 上下文注入（记忆检索+格式化）
│   │
│   ├── llm/                        # LLM 客户端抽象
│   │   ├── mod.rs
│   │   ├── provider.rs             # Provider trait 定义
│   │   ├── openai.rs               # OpenAI 兼容（含 DeepSeek/MiniMax）
│   │   ├── anthropic.rs            # Anthropic Claude
│   │   ├── client_pool.rs          # 客户端连接池 & 缓存
│   │   └── streaming.rs            # SSE 流式响应处理
│   │
│   ├── tool/                       # 工具调用系统
│   │   ├── mod.rs
│   │   ├── registry.rs             # 工具注册表
│   │   ├── executor.rs             # 工具执行器
│   │   ├── quant_signal.rs         # 量化信号工具
│   │   ├── news_search.rs          # 新闻搜索工具
│   │   └── skill_loader.rs         # 动态 Skill 加载
│   │
│   ├── http/                       # HTTP REST API
│   │   ├── mod.rs
│   │   ├── routes.rs               # 路由定义
│   │   ├── handler/
│   │   │   ├── mod.rs
│   │   │   ├── chat_handler.rs     # 对话端点
│   │   │   ├── memory_handler.rs   # 记忆管理端点
│   │   │   ├── analysis_handler.rs # 分析端点
│   │   │   └── health_handler.rs   # 健康检查
│   │   └── middleware/
│   │       ├── mod.rs
│   │       ├── auth.rs             # JWT 认证中间件
│   │       └── rate_limit.rs       # 速率限制
│   │
│   ├── grpc/                       # gRPC 服务（内部调用）
│   │   ├── mod.rs
│   │   ├── server.rs
│   │   └── ai_service.rs
│   │
│   └── ws/                         # WebSocket（实时推送）
│       ├── mod.rs
│       └── handler.rs
│
└── tests/
    ├── integration/
    │   ├── chat_test.rs
    │   ├── memory_test.rs
    │   └── analysis_test.rs
    └── common/
        └── test_setup.rs
```

---

## 3. API 设计

### 3.1 HTTP REST 端点

所有端点保持与 `koduck-agent`（Python）和 `koduck-backend/koduck-ai`（Java）完全兼容。

#### 3.1.1 健康检查

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/health` | 健康检查 | 否 |
| GET | `/v1/models` | 列出可用模型 | 否 |

#### 3.1.2 AI 对话

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/v1/ai/chat` | 同步对话（JSON） | 是 |
| POST | `/api/v1/ai/chat/stream` | 流式对话（SSE） | 是 |
| POST | `/v1/chat/completions` | OpenAI 兼容接口 | 否* |

> *OpenAI 兼容接口可选认证，支持直接使用 API Key。

#### 3.1.3 会话管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/ai/sessions` | 获取用户会话列表 | 是 |
| GET | `/api/v1/ai/sessions/{sessionId}` | 获取会话详情 | 是 |
| DELETE | `/api/v1/ai/sessions/{sessionId}` | 删除会话 | 是 |
| PATCH | `/api/v1/ai/sessions/{sessionId}` | 更新会话标题 | 是 |

#### 3.1.4 记忆管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| DELETE | `/api/v1/ai/memory/session/{sessionId}` | 清空会话记忆 | 是 |
| DELETE | `/api/v1/ai/memory/profile` | 清空用户偏好记忆 | 是 |
| GET | `/api/v1/ai/memory/session/{sessionId}` | 查看会话摘要 | 是 |
| GET | `/api/v1/ai/memory/stats` | 记忆统计 | 是 |

#### 3.1.5 组合分析

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/v1/ai/analysis/portfolio/{portfolioId}/risk` | 风险评估 | 是 |
| GET | `/api/v1/ai/analysis/portfolio/{portfolioId}/return` | 收益分析 | 是 |
| GET | `/api/v1/ai/analysis/portfolio/{portfolioId}/optimization` | 优化建议 | 是 |
| GET | `/api/v1/ai/analysis/portfolio/{portfolioId}/sector` | 行业分布 | 是 |

### 3.2 SSE 流式协议

流式端点 `/api/v1/ai/chat/stream` 使用 Server-Sent Events，与现有 Python 实现完全兼容：

```
event: start
data: {"model":"deepseek-chat","provider":"deepseek","session_id":"sess_abc123"}

event: delta
data: {"content":"根据"}

event: delta
data: {"content":"最新的"}

event: tool
data: {"session_id":"sess_abc123","type":"tool.completed","tool_name":"get_quant_signal","tool_call_id":"call_1","ok":true,"result_preview":"EMA20=12.35","elapsed_ms":230}

event: delta
data: {"content":"技术指标显示..."}

event: done
data: {"content":"完整响应内容","model":"deepseek-chat","provider":"deepseek","session_id":"sess_abc123","usage":{"prompt_tokens":150,"completion_tokens":200,"total_tokens":350}}

event: error
data: {"code":500,"message":"LLM 服务超时","session_id":"sess_abc123"}
```

### 3.3 gRPC 服务（内部）

用于与其他微服务（如 `koduck-auth`）的内部通信：

```protobuf
service AiService {
  // 会话管理
  rpc CreateSession(CreateSessionRequest) returns (CreateSessionResponse);
  rpc GetSession(GetSessionRequest) returns (Session);

  // 分析服务（供 portfolio 模块调用）
  rpc AnalyzePortfolioRisk(AnalyzePortfolioRequest) returns (AnalysisResponse);
  rpc AnalyzePortfolioReturn(AnalyzePortfolioRequest) returns (AnalysisResponse);
}
```

---

## 4. 核心模块设计

### 4.1 LLM 客户端抽象

```rust
/// LLM 提供商统一 trait
#[async_trait]
pub trait LlmProvider: Send + Sync {
    /// 非流式对话
    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse>;

    /// 流式对话
    async fn chat_completion_stream(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<SSEEvent>> + Send>>>;

    /// 提供商名称
    fn provider(&self) -> &str;

    /// 支持的模型列表
    fn supported_models(&self) -> Vec<ModelInfo>;
}
```

#### 提供商实现

| 提供商 | 实现文件 | 说明 |
|--------|----------|------|
| OpenAI | `llm/openai.rs` | 兼容 OpenAI API（含 DeepSeek、MiniMax） |
| Anthropic | `llm/anthropic.rs` | Claude 系列模型 |
| Local | `llm/openai.rs` | 本地 Ollama/vLLM（OpenAI 兼容协议） |

**关键设计**：OpenAI 兼容实现覆盖 OpenAI、DeepSeek、MiniMax、本地模型，仅 `api_base` 和 `model` 不同，减少重复代码。

### 4.2 对话编排（ChatService）

核心对话流程：

```
用户请求
  │
  ├─ 1. JWT 认证 → 提取 user_id
  ├─ 2. 解析 sessionId（前端透传或自动生成）
  ├─ 3. 记忆注入（ContextService）
  │     ├─ L1: 查询最近 N 轮会话消息
  │     ├─ L2: 检索用户偏好 & 高价值摘要
  │     └─ 格式化为 system prompt 注入
  ├─ 4. 工具注册（根据 runtimeOptions）
  │     ├─ 量化信号、新闻搜索等内置工具
  │     └─ 动态加载的 Skill 工具
  ├─ 5. 调用 LLM（LlmProvider）
  │     ├─ 非流式: 等待完整响应
  │     └─ 流式: SSE 逐 chunk 推送
  ├─ 6. 工具调用循环（如有 tool_calls）
  │     ├─ 执行工具 → 获取结果
  │     ├─ 将工具结果追加到消息历史
  │     └─ 重新调用 LLM（最多 5 轮）
  ├─ 7. 异步持久化
  │     ├─ 保存用户消息
  │     ├─ 保存助手响应
  │     └─ 更新会话元信息
  └─ 8. 记忆更新（MemoryService）
        ├─ 价值评分 → 是否值得记住
        ├─ 提取实体 & 关键词
        └─ 更新 L1/L2 记忆
```

### 4.3 工具调用系统

```rust
/// 工具定义
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: JsonSchema,
    pub policy: ToolPolicy,     // SAFE | RESTRICTED
    pub source: ToolSource,     // BUILTIN | SKILL
}

/// 工具执行 trait
#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn definition(&self) -> &ToolDefinition;
    async fn execute(&self, args: Value, ctx: &ToolContext) -> Result<Value>;
}

/// 工具上下文（注入 user_id、session_id 等）
pub struct ToolContext {
    pub user_id: i64,
    pub session_id: String,
    pub db_pool: PgPool,
}
```

#### 内置工具

| 工具 | 策略 | 功能 |
|------|------|------|
| `get_quant_signal` | SAFE | 获取 A 股量化信号（EMA20/EMA60/MACD） |
| `search_web_news` | SAFE | 搜索网络新闻 |
| `search_finance_news` | SAFE | 搜索财经新闻（财联社/彭博等） |

### 4.4 记忆系统

沿用 `koduck-agent` 的 L1/L2 分层记忆架构，复用已有数据库表。

#### L1（短期记忆）

- **表**: `chat_sessions` + `chat_messages`
- **功能**: 存储原始对话消息，按 `(user_id, session_id, created_at DESC)` 索引
- **注入策略**: 取最近 N 轮（默认 20 轮）消息作为上下文

#### L2（长期记忆）

- **表**: `memory_l1_summaries` + `memory_l2_themes`
- **功能**: 高价值会话摘要 + 主题聚合
- **价值评分**: 综合重要性、密度、时效性、新颖性、意图匹配度
- **检索算法**: 相关性(0.4) × 价值分(0.35) × 时间衰减(0.25)

#### 上下文注入

```rust
pub struct ContextService {
    chat_repo: ChatRepository,
    memory_repo: MemoryRepository,
}

impl ContextService {
    /// 检索并格式化记忆上下文
    pub async fn inject_context(
        &self,
        user_id: i64,
        session_id: &str,
        messages: &mut Vec<Message>,
        config: &MemoryConfig,
    ) -> Result<()> {
        // 1. 跳过简单查询（"你好"、"help" 等）
        // 2. 从 L2 检索相关主题摘要（max 3）
        // 3. 从 L1 检索近期会话消息（max 20 轮）
        // 4. 按 final_score 排序，控制 token budget
        // 5. 格式化为 system prompt 前缀注入
    }
}
```

### 4.5 组合分析服务

从 Java 模块迁移的规则引擎，提供确定性分析：

```rust
pub struct AnalysisService {
    repo: AnalysisRepository,
    config: RiskConfig,
}

impl AnalysisService {
    /// 风险评估
    pub async fn assess_risk(&self, portfolio_id: i64) -> Result<RiskAssessment> {
        // HHI 指数 → 集中度风险
        // 历史波动率 → 波动风险
        // 综合评分 → HIGH / MEDIUM / LOW
    }

    /// 收益分析
    pub async fn analyze_return(&self, portfolio_id: i64) -> Result<ReturnAnalysis> {
        // 收益率计算
        // 最大回撤
        // 贡献度排名
    }

    /// 优化建议
    pub async fn suggest_optimization(&self, portfolio_id: i64) -> Result<OptimizationSuggestion> {
        // 分散化建议
        // 再平衡建议
    }

    /// 行业分布
    pub async fn analyze_sector(&self, portfolio_id: i64) -> Result<SectorDistribution> {
        // 行业持仓占比
        // 集中度分析
    }
}
```

---

## 5. 数据模型

### 5.1 数据库表（复用现有 Schema）

以下表已在 `V1__baseline.sql` 和 `004_memory_v2.sql` 中定义，Rust 服务直接使用：

#### 核心表

| 表名 | 用途 | 来源 |
|------|------|------|
| `chat_sessions` | 会话元信息 | V1__baseline.sql |
| `chat_messages` | 会话消息 | V1__baseline.sql |
| `user_memory_profile` | 用户偏好 | V1__baseline.sql |
| `memory_l1_summaries` | 高价值摘要 | 004_memory_v2.sql |
| `memory_l2_themes` | 主题聚合 | 004_memory_v2.sql |
| `memory_access_log` | 访问日志 | 004_memory_v2.sql |

#### Rust 模型映射（sqlx）

```rust
#[derive(Debug, sqlx::FromRow)]
pub struct ChatSession {
    pub id: i64,
    pub user_id: i64,
    pub session_id: String,
    pub title: Option<String>,
    pub status: String,
    pub last_message_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ChatMessage {
    pub id: i64,
    pub user_id: i64,
    pub session_id: String,
    pub role: String,        // "system" | "user" | "assistant" | "tool"
    pub content: String,
    pub token_count: Option<i32>,
    pub metadata: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub has_summary: Option<bool>,
    pub summary_id: Option<uuid::Uuid>,
}
```

### 5.2 API DTO

```rust
// === 请求 DTO ===

#[derive(Debug, Deserialize)]
pub struct SimpleChatRequest {
    pub messages: Vec<Message>,
    pub session_id: Option<String>,
    pub provider: Option<String>,
    pub api_key: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
    pub runtime_options: Option<RuntimeOptions>,
}

#[derive(Debug, Deserialize)]
pub struct RuntimeOptions {
    pub enable_tools: Option<bool>,
    pub allow_restricted_tools: Option<bool>,
    pub allow_market_skills: Option<bool>,
    pub sub_agents: Option<Vec<SubAgent>>,
    pub memory: Option<MemoryOptions>,
}

#[derive(Debug, Deserialize)]
pub struct MemoryOptions {
    pub retrieve_context: Option<bool>,  // 默认 true
    pub auto_summarize: Option<bool>,
    pub user_id: Option<i64>,
}

// === 响应 DTO ===

#[derive(Debug, Serialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,         // "chat.completion"
    pub created: i64,
    pub model: String,
    pub provider: String,
    pub session_id: String,
    pub choices: Vec<Choice>,
    pub usage: Option<Usage>,
}
```

---

## 6. 配置管理

### 6.1 配置结构

```toml
[server]
host = "0.0.0.0"
port = 8001
grpc_port = 50051

[database]
url = "postgresql://koduck:koduck@localhost:5432/koduck_dev"
max_connections = 20

[redis]
url = "redis://localhost:6379"
key_prefix = "koduck:ai:"

[llm]
default_provider = "deepseek"          # openai | anthropic | deepseek | minimax | local
timeout_ms = 30000
max_retries = 3
temperature = 0.7
max_tokens = 2000

[llm.providers.openai]
api_key = ""                          # 或通过 OPENAI_API_KEY 环境变量
api_base = "https://api.openai.com/v1"
model = "gpt-4o-mini"

[llm.providers.deepseek]
api_key = ""
api_base = "https://api.deepseek.com/v1"
model = "deepseek-chat"

[llm.providers.anthropic]
api_key = ""
model = "claude-sonnet-4-20250514"

[llm.providers.minimax]
api_key = ""
api_base = "https://api.minimax.chat/v1"
model = "MiniMax-M2.7"

[memory]
enabled = true
l1_max_turns = 20
l2_max_themes = 3
token_budget = 1500
auto_summarize = true

[analysis]
enabled = true
auto_analyze_new_portfolio = true
auto_analyze_signal = true

[analysis.risk]
high_concentration_threshold = 0.30
medium_concentration_threshold = 0.20
high_volatility_threshold = 0.25
medium_volatility_threshold = 0.15

[tools]
enabled = true
skill_timeout_seconds = 20
skill_lockfile = "skills.lock"

[jwt]
# 复用 koduck-auth 的公钥进行 token 验证
public_key_path = ""
jwks_url = ""
```

### 6.2 环境变量覆盖

所有配置项支持 `KODUCK_AI__` 前缀的环境变量覆盖，例如：

```bash
KODUCK_AI__LLM__DEFAULT_PROVIDER=deepseek
KODUCK_AI__LLM__PROVIDERS__DEEPSEEK__API_KEY=sk-xxx
KODUCK_AI__DATABASE__URL=postgresql://...
KODUCK_AI__MEMORY__ENABLED=true
```

---

## 7. 依赖选型

| 类别 | Crate | 版本 | 用途 |
|------|-------|------|------|
| **Web 框架** | `axum` | 0.7+ | HTTP 服务（与 koduck-auth 一致） |
| **异步运行时** | `tokio` | 1.x | 异步 I/O |
| **gRPC** | `tonic` | 0.12+ | gRPC 服务 |
| **数据库** | `sqlx` | 0.8+ | PostgreSQL（compile-time 检查） |
| **Redis** | `fred` 或 `redis` | 7.x | 缓存、速率限制 |
| **HTTP 客户端** | `reqwest` | 0.12+ | 调用 LLM API |
| **SSE** | `axum::response::sse` | 内置 | 流式响应 |
| **序列化** | `serde` / `serde_json` | 1.x | JSON 处理 |
| **配置** | `config` | 0.14+ | 配置管理 |
| **日志** | `tracing` + `tracing-subscriber` | 0.1+ | 结构化日志 |
| **错误** | `thiserror` + `anyhow` | 1.x | 错误处理 |
| **认证** | `jsonwebtoken` | 9.x | JWT 验证 |
| **加密** | `argon2` | 0.5+ | 密码哈希（如有需要） |
| **UUID** | `uuid` | 1.x | session_id 生成 |
| **时间** | `chrono` | 0.4+ | 时间处理 |

---

## 8. 关键实现细节

### 8.1 SSE 流式响应

```rust
pub async fn chat_stream(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SimpleChatRequest>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = async_stream::stream! {
        // 1. 认证 + 参数校验
        // 2. 记忆上下文注入
        // 3. 发送 start 事件
        yield Ok(Event::default().event("start").data(...));

        // 4. 调用 LLM 流式 API
        let mut response_stream = llm_provider.chat_completion_stream(request).await?;

        while let Some(chunk) = response_stream.next().await {
            match chunk? {
                SSEChunk::Delta(content) => {
                    yield Ok(Event::default().event("delta").data(...));
                }
                SSEChunk::ToolCall(call) => {
                    // 执行工具
                    let result = tool_executor.execute(call).await;
                    yield Ok(Event::default().event("tool").data(...));
                }
                SSEChunk::Done(usage) => {
                    yield Ok(Event::default().event("done").data(...));
                }
            }
        }
    };

    Sse::new(stream)
}
```

### 8.2 JWT 认证（复用 koduck-auth）

Rust AI 服务作为内部服务，验证 `koduck-auth` 签发的 JWT：

```rust
// 方案 1: JWKS 端点（推荐）
pub struct JwtVerifier {
    jwks_client: JwksClient,
}

impl JwtVerifier {
    pub async fn verify(&self, token: &str) -> Result<Claims> {
        let key_set = self.jwks_client.get().await?;
        let key = key_set.keys.iter().find(|k| k.alg == "RS256")?;
        let validation = Validation::new(Algorithm::RS256);
        let claims = decode::<Claims>(token, &DecodingKey::from_rsa_components(key.n, key.e), &validation)?;
        Ok(claims.into_inner())
    }
}
```

### 8.3 工具调用循环

```rust
pub async fn chat_with_tools(
    &self,
    messages: Vec<Message>,
    tools: Vec<Box<dyn Tool>>,
    max_rounds: usize,
) -> Result<ChatCompletionResponse> {
    let mut messages = messages;
    let mut round = 0;

    loop {
        let response = self.llm.chat_completion(ChatCompletionRequest {
            messages: messages.clone(),
            tools: Some(tool_definitions(&tools)),
            ..Default::default()
        }).await?;

        let has_tool_calls = response.choices[0]
            .message
            .tool_calls
            .map_or(false, |t| !t.is_empty());

        if !has_tool_calls || round >= max_rounds {
            return Ok(response);
        }

        // 追加 assistant 消息（含 tool_calls）
        messages.push(response.choices[0].message.clone().into());

        // 执行每个工具调用
        for call in response.choices[0].message.tool_calls.unwrap() {
            let tool = tools.iter().find(|t| t.name() == &call.function.name);
            let result = tool.execute(call.function.arguments, &self.ctx).await?;
            messages.push(Message::tool_response(call.id, result));
        }

        round += 1;
    }
}
```

### 8.4 记忆价值评分

```rust
pub struct ValueScorer {
    config: ScoringConfig,
}

impl ValueScorer {
    /// 快速评估消息记忆价值（0-1）
    pub fn quick_score(&self, content: &str) -> f32 {
        let mut score = 0.0;

        // 重要性（含决策性关键词）
        let importance_keywords = ["决定", "买入", "卖出", "止损", "目标价",
                                    "策略", "计划", "调整", "配置"];
        score += self.count_keyword_ratio(content, &importance_keywords) * 0.3;

        // 密度（信息量）
        score += self.estimate_density(content) * 0.2;

        // 新颖性（与已知事实的对比 - 需要已有记忆）
        // 时效性（市场数据时效性）

        score.min(1.0)
    }
}
```

---

## 9. 与前端对接

### 9.1 Nginx 代理配置

前端通过 APISIX/Nginx 代理访问，需更新路由：

```nginx
# 现有 Java 后端路由
location /api/v1/ {
    proxy_pass http://backend:8080;
}

# 新增 Rust AI 服务路由（优先匹配）
location /api/v1/ai/ {
    proxy_pass http://koduck-ai-server:8001;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;                    # SSE 必须
    proxy_cache off;                        # SSE 必须
    proxy_read_timeout 300s;                # LLM 响应较慢
}

location /v1/ {
    proxy_pass http://koduck-ai-server:8001;
    proxy_buffering off;
    proxy_read_timeout 300s;
}

location /health {
    proxy_pass http://koduck-ai-server:8001;
}
```

### 9.2 前端无需改动

由于 API 路径和响应格式完全兼容，前端代码无需任何修改：

- `POST /api/v1/ai/chat/stream` → SSE 流式（路径不变）
- `POST /api/v1/ai/chat` → 同步对话（路径不变）
- JWT 认证机制不变（Bearer token）
- SSE 事件格式不变（start / delta / tool / done / error）

---

## 10. 实施计划

### Phase 1: 项目骨架与基础设施（预计 2-3 天）

- [ ] 初始化 Cargo 项目，配置依赖
- [ ] 搭建项目目录结构
- [ ] 实现配置管理（`config.rs`）
- [ ] 实现错误类型（`error.rs`）
- [ ] 实现应用状态（`state.rs`）
- [ ] 健康检查端点
- [ ] Docker 构建配置

### Phase 2: LLM 客户端层（预计 3-4 天）

- [ ] 定义 `LlmProvider` trait
- [ ] 实现 OpenAI 兼容客户端（覆盖 OpenAI / DeepSeek / MiniMax / Local）
- [ ] 实现 Anthropic Claude 客户端
- [ ] SSE 流式响应处理
- [ ] 客户端连接池与缓存
- [ ] 重试与超时机制
- [ ] 模型列表接口

### Phase 3: 数据访问层（预计 2 天）

- [ ] sqlx 迁移脚本（复用已有 Schema）
- [ ] `ChatRepository`（会话 + 消息 CRUD）
- [ ] `MemoryRepository`（L1/L2 记忆读写）
- [ ] `AnalysisRepository`（组合数据查询）

### Phase 4: 核心对话服务（预计 4-5 天）

- [ ] `ChatService` 对话编排
- [ ] SSE 流式端点实现
- [ ] 工具调用系统（注册 + 执行 + 循环）
- [ ] 内置工具实现（量化信号、新闻搜索）
- [ ] JWT 认证中间件
- [ ] 速率限制中间件

### Phase 5: 记忆系统（预计 3-4 天）

- [ ] `ContextService` 上下文注入
- [ ] `ValueScorer` 价值评分
- [ ] `MemoryService` 记忆更新（摘要、实体提取、主题聚合）
- [ ] 记忆管理 API 端点
- [ ] 定时清理任务

### Phase 6: 组合分析（预计 2 天）

- [ ] `AnalysisService` 风险评估
- [ ] `AnalysisService` 收益分析
- [ ] `AnalysisService` 优化建议
- [ ] `AnalysisService` 行业分布
- [ ] 分析 API 端点

### Phase 7: gRPC 与集成（预计 2-3 天）

- [ ] gRPC 服务定义（proto）
- [ ] gRPC 服务实现
- [ ] 与 `koduck-auth` 的 JWT 验证对接
- [ ] 与 Redis 的缓存/速率限制对接
- [ ] 端到端集成测试

### Phase 8: 测试与部署（预计 2-3 天）

- [ ] 单元测试（各 service/repository）
- [ ] 集成测试（完整对话流程）
- [ ] 性能基准测试
- [ ] K8s 部署配置
- [ ] APISIX 路由配置
- [ ] 文档完善

---

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM API 不稳定 | 对话超时/失败 | 指数退避重试 + 熔断器 + 优雅降级 |
| SSE 连接中断 | 流式响应丢失 | 前端重连机制 + 消息持久化保障 |
| 记忆上下文过长 | Token 超限 | 严格 token budget 控制 + 摘要压缩 |
| 多工具调用循环 | 响应延迟高 | 最大轮次限制（5 轮）+ 超时保护 |
| 数据库 Schema 变更 | 兼容性问题 | 复用已有 Schema + sqlx 迁移管理 |

---

## 12. 性能预期

| 指标 | Java (Spring Boot) | Python (FastAPI) | Rust (预期) |
|------|-------------------|-------------------|-------------|
| 冷启动 | 5-10s | 1-2s | <100ms |
| 内存占用 | 300-500MB | 100-200MB | 30-50MB |
| 请求延迟 (P50) | 20-50ms | 10-30ms | <5ms |
| 并发连接 | 500-1000 | 200-500 | 10000+ |
| SSE 并发流 | 200 | 100 | 5000+ |

---

## 13. 相关文档

- [Agent Memory Epic #189](../ai-stateful-chat/agent-memory-epic-189.md)
- [WebSocket 实时架构 ADR-1001](../../docs/adr/1001-websocket-realtime-architecture.md)
- [koduck-agent README](../../koduck-agent/README.md)
- [Memory Setup Checklist](../../koduck-agent/memory_SETUP_CHECKLIST.md)
- [koduck-auth Rust 实现](../../koduck-auth/)（架构参考）
