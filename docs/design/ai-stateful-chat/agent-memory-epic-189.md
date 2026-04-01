# Agent Memory（Epic #189）设计与运维说明

## 1. 架构概览

本次实现采用 L1/L2 分层记忆：

- L1（会话短期记忆）：`chat_sessions` + `chat_messages`
- L2（用户偏好记忆）：`user_memory_profile`

调用链路：

1. 前端 `AIChat` 生成并透传 `sessionId`
2. backend `AiAnalysisService` 在调用 agent 前注入 L1/L2 记忆上下文
3. backend 在流式响应过程中异步写回用户消息和 assistant 消息
4. backend 基于用户输入更新 L2 偏好（风险偏好、关注标的、来源偏好）

## 2. 数据模型

迁移脚本：`V22__create_agent_memory_chat_tables.sql`

### chat_sessions

- 作用：记录会话元信息
- 关键字段：`user_id`、`session_id`、`last_message_at`、`status`
- 约束：`(user_id, session_id)` 唯一

### chat_messages

- 作用：记录会话消息内容（system/user/assistant/tool）
- 关键字段：`user_id`、`session_id`、`role`、`content`、`metadata`
- 索引：`(user_id, session_id, created_at DESC)`

### user_memory_profile

- 作用：记录用户偏好与事实
- 关键字段：`risk_preference`、`watch_symbols`、`preferred_sources`、`profile_facts`
- 主键：`user_id`

## 3. 配置项

- `memory.enabled`（默认 `true`）：是否启用记忆
- `memory.l1.max-turns`（默认 `20`）：L1 注入轮数上限

## 4. API

新增 memory 管理接口：

- `DELETE /api/v1/ai/memory/session/{sessionId}`
  - 清空当前会话消息
- `DELETE /api/v1/ai/memory/profile`
  - 清空用户偏好记忆
- `GET /api/v1/ai/memory/session/{sessionId}`
  - 查看当前会话摘要（调试用）

## 5. 运维与排障

### 数据清理

- 会话级清理可直接调用 `DELETE /api/v1/ai/memory/session/{sessionId}`
- 用户级清理可调用 `DELETE /api/v1/ai/memory/profile`

### 常见问题

1. 记忆未生效
   - 检查 `memory.enabled=true`
   - 检查请求中是否带 `sessionId`
   - 检查数据库是否已执行到 V22

2. 注入内容过长
   - 调小 `memory.l1.max-turns`
   - 观察 `AiAnalysisService` 注入日志

## 6. 隐私与数据策略

- 记忆按 `user_id` 强隔离
- 不跨用户共享记忆
- 会话和偏好支持用户主动清除
- 禁止在日志中输出 API 密钥与敏感凭据
