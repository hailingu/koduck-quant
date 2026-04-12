# koduck-memory Task 8.4 灰度与回滚演练记录

## 演练基本信息

- **演练日期**: 2026-04-13
- **演练类型**: southbound canary + fail-open + route rollback
- **演练人员**: @hailingu
- **对应任务**: `docs/implementation/koduck-memory-koduck-ai-tasks.md` Task 8.4
- **对应 Issue**: #843

---

## 演练目标

本次演练按确认后的 Task 8.4 范围执行：

- [x] 新版本 `koduck-memory` canary 实例可被 `koduck-ai` 通过 APISIX southbound 路由命中
- [x] memory upstream 故障时，`koduck-ai` 主 chat 链路继续返回成功响应
- [x] APISIX `ai-memory-grpc` upstream 可回滚到原始稳定配置
- [ ] image version rollback

说明：
本次明确不把 image version rollback 作为 Task 8.4 的验收动作。

---

## 演练环境

| 检查项 | 状态 | 备注 |
|--------|------|------|
| `dev-koduck-memory` Ready | ✅ | `1/1 Available` |
| `dev-koduck-ai` Ready | ✅ | drill 过程中临时切 `LLM_STUB_ENABLED=true` |
| APISIX Admin API 可访问 | ✅ | 通过本地 `kubectl port-forward` 到 `19180` |
| `koduck-auth` / `koduck-user` | ⚠️ | 处于 `CrashLoopBackOff`，因此 drill 不依赖 northbound 登录链路 |

---

## 执行入口

本次演练使用新增脚本：

```bash
./k8s/drills/koduck-memory-canary-drill.sh
```

脚本实际执行内容：

1. 备份 APISIX `ai-memory-grpc` upstream
2. 临时开启 `koduck-ai` stub 模式
3. 创建 `dev-koduck-memory-canary` / `dev-koduck-memory-canary-grpc`
4. 切换 canary-only upstream 做 smoke
5. 切换 weighted upstream（stable=9, canary=1）
6. 切坏 upstream 验证 fail-open
7. 恢复原始 upstream 验证 route rollback
8. 自动清理 canary 与临时配置

---

## 演练结果

### 1. Canary smoke

- 结果: ✅ 通过
- 方式: upstream 暂时切到 `{"dev-koduck-memory-canary-grpc:50051":1}`
- 证据:
  - 脚本输出 `Canary-only smoke passed`
  - canary pod 日志中出现真实 memory RPC 访问

### 2. Weighted canary

- 结果: ✅ 通过
- 方式: upstream 切到 stable/canary 双节点
- 目标权重:

```json
{
  "dev-koduck-memory-grpc:50051": 9,
  "dev-koduck-memory-canary-grpc:50051": 1
}
```

- 证据:
  - 脚本输出 `Weighted canary configuration verified`
  - APISIX Admin API 返回的 `nodes` 权重符合预期

### 3. Fail-open

- 结果: ✅ 通过
- 方式: upstream 临时切到不存在的 `dev-koduck-memory-drill-fault:50051`
- 观察结果:
  - `/api/v1/ai/chat` 仍返回成功响应
  - `koduck-ai` 日志中出现 memory 失败后的 warning：
    - `get_session failed; continuing with empty session snapshot`
    - `upsert_session_meta failed; continuing with request-local session context`
    - `query_memory failed; continuing without retrieved memory hits`
    - `append_memory failed after chat response; continuing with successful answer`

### 4. Route rollback

- 结果: ✅ 通过
- 方式: 将 APISIX `ai-memory-grpc` upstream 恢复为演练前备份 payload
- 证据:
  - 脚本输出 `Route rollback verified`
  - 恢复后 chat 请求继续返回成功

---

## 环境噪音与发现

本次演练暴露了两个与 Task 8.4 本身无关、但值得后续单独处理的环境问题：

1. `koduck-auth` / `koduck-user` 当前在 `koduck-dev` 中处于 `CrashLoopBackOff`，导致 drill 不能依赖 northbound 登录链路，只能直接对 `koduck-ai` 做本地 port-forward + APISIX OIDC header 模式验证。
2. 当前 `koduck-memory` 的 session / append 路径存在既有 schema / SQL 错误：
   - `column "extra" does not exist`
   - advisory lock 解码类型不匹配

这些问题不会否定 Task 8.4 的灰度与 fail-open 验证结论，因为：

- canary smoke 已证明新版本 memory 实例能被 APISIX + `koduck-ai` 命中
- fail-open 演练故意把 upstream 切坏后，主 chat 仍成功返回

但建议在后续任务里单独修复这些环境与 schema 噪音。

---

## 演练结论

- [x] 新版本 `koduck-memory` 可灰度接入 `koduck-ai`
- [x] 故障时 `koduck-ai` 主链路仍可继续
- [x] route rollback 已演练
- [ ] image version rollback 未纳入本次 Task 8.4 验收范围

因此，按当前 agreed scope，Task 8.4 可视为完成。
