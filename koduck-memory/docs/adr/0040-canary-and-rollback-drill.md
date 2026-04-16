# ADR-0040: 灰度接入与回滚演练闭环

- Status: Accepted
- Date: 2026-04-13
- Issue: #843

## Context

Task 8.4 要求我们在 `koduck-dev` 中完成三件事：

1. 验证 `koduck-ai -> APISIX -> koduck-memory` 的 southbound 链路在新版本 memory-service 接入时可继续工作。
2. 验证 memory 故障时，`koduck-ai` 仍然遵循 fail-open 原则，主 chat 链路继续返回成功响应。
3. 演练 route rollback，而不是只在文档中静态描述回滚原则。

前序任务已经提供了必要基础：

- Task 6.1 / ADR-0019 打通了 `koduck-ai -> koduck-memory` 主链路。
- Task 6.2 / ADR-0020 已将 memory 调用改为 fail-open。
- Task 8.1 / ADR-0023 已将 southbound gRPC 治理收敛到 APISIX，并为 upstream / route 提供了可回滚的 Admin API 更新逻辑。

但在 Task 8.4 之前，仓库里仍缺两样关键资产：

1. **可重复执行的 drill 脚本**：运维没有一条命令可以在 dev 真正跑完“灰度 + 故障 + 回滚”闭环。
2. **真实演练记录**：没有证据表明当前 southbound 链路已经在故障与回滚场景下被验证过。

## Decision

我们将 Task 8.4 落地为“脚本 + 演练记录”的双重交付：

### 1. 新增可执行 drill 脚本

新增 [`k8s/drills/koduck-memory-canary-drill.sh`](../../../k8s/drills/koduck-memory-canary-drill.sh)，
作为 dev 环境的标准演练入口。脚本负责：

1. 启动 APISIX Admin API 本地 port-forward，并备份 `ai-memory-grpc` upstream 原始配置。
2. 临时把 `koduck-ai` 切到 `LLM_STUB_ENABLED=true`，让 drill 聚焦 memory southbound，而不依赖外部 LLM 可用性。
3. 创建临时 canary deployment/service：`dev-koduck-memory-canary` / `dev-koduck-memory-canary-grpc`。
4. 将 APISIX upstream 切为 weighted stable/canary 节点，验证新版本 memory-service 已能接入 `koduck-ai`。
5. 将 APISIX upstream 临时切到坏地址，验证 `koduck-ai` 仍按 fail-open 返回成功 chat，并记录 warning 日志。
6. 恢复原始 upstream，验证 route rollback。
7. 退出时自动恢复 upstream、恢复 `koduck-ai` stub 设置、清理 canary 资源。

### 2. 固化演练记录

新增一次真实执行记录到 [`docs/releases/drills/2026-04-13-koduck-memory-canary-drill.md`](../../../docs/releases/drills/2026-04-13-koduck-memory-canary-drill.md)，
沉淀本次 drill 的：

- 演练步骤
- 验证结果
- 回滚动作
- 风险与后续建议

### 3. 验收口径

Task 8.4 的两个验收标准按以下口径视为完成：

1. **“新版本 memory-service 可灰度接入 `koduck-ai`”**：
   - canary deployment 在 dev 成功 rollout；
   - APISIX upstream 能同时持有 stable/canary 节点；
   - canary pod 日志观察到真实 memory RPC 流量。

2. **“故障时 `koduck-ai` 主链路仍可继续”**：
   - APISIX upstream 指向故障地址时，`/api/v1/ai/chat` 仍返回成功响应；
   - `koduck-ai` 日志中出现 fail-open warning。

## Consequences

正面影响：

1. Task 8.4 从“原则描述”变成了可重复执行的运维闭环。
2. southbound route rollback 有了明确脚本路径。
3. 以后升级 `koduck-memory` 时，可以先在 dev 复用同一脚本做演练。
4. 通过将 AI 切到 stub 模式，drill 的失败面被收敛到 memory / APISIX，而不会被外部 LLM 波动污染。

代价与权衡：

1. drill 脚本默认依赖本地 `kubectl`、`curl`、`jq`，并要求开发机能访问 `koduck-dev`。
2. 将 `koduck-ai` 临时切到 stub 模式意味着 drill 聚焦 southbound 路径，而不是外部 LLM 的端到端链路。
3. canary deployment 是临时资源，不纳入常驻 Kustomize overlay；脚本退出后会清理。

## Compatibility Impact

1. 不修改 `memory.v1` protobuf，不引入 southbound breaking change。
2. 不改变 `k8s/overlays/dev` 的常驻部署拓扑；canary 资源只在 drill 期间存在。
3. 对 `koduck-ai` 的 `LLM_STUB_ENABLED` 修改是临时性的，脚本退出后会恢复原值。

## Alternatives Considered

### Alternative A: 只写 runbook，不提供脚本

未采用。
Task 8.4 明确要求“演练”，单纯 runbook 仍然依赖人工步骤，难以稳定复现。

### Alternative B: 让 canary 资源常驻在 Kustomize overlay 中

未采用。
Task 8.4 的目标是演练能力，不是把 dev 长期改成双 deployment 拓扑。
常驻 canary 会增加运维噪音与资源开销。

### Alternative C: 使用真实 LLM 流量做 fail-open 演练

未采用。
Task 8.4 要验证的是 memory southbound 故障不阻塞主 chat。
如果 drill 同时依赖外部 LLM，可重复性会被外部网络和厂商可用性显著影响。
