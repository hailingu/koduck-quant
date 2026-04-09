# Koduck-Auth ↔ Koduck-User Internal API Contract (Task 5.2)

## 目标

固定 `koduck-auth` 调用 `koduck-user` 内部 API 的最小契约，确保状态码、响应结构、超时/重试边界无歧义。

---

## 契约矩阵

| 场景 | 接口 | 请求 | 成功 | 失败 |
|------|------|------|------|------|
| 按用户名查询用户 | `GET /internal/users/by-username/{username}` | Header: `X-Consumer-Username`（可选） | `200` + `UserDetailsResponse` | `404`（无响应体） |
| 按邮箱查询用户 | `GET /internal/users/by-email/{email}` | Header: `X-Consumer-Username`（可选） | `200` + `UserDetailsResponse` | `404`（无响应体） |
| 创建用户 | `POST /internal/users` | JSON: `CreateUserRequest` | `200` + `UserDetailsResponse` | `400`（校验失败，`ApiResponse`） / `409`（username/email 冲突，`ApiResponse`） |
| 更新登录信息 | `PUT /internal/users/{userId}/last-login` | JSON: `LastLoginUpdateRequest` | `200`（空体） | `404`（用户不存在，`ApiResponse`） |
| 查询角色 | `GET /internal/users/{userId}/roles` | - | `200` + `List<String>` | `404`（用户不存在，`ApiResponse`） |
| 查询权限 | `GET /internal/users/{userId}/permissions` | - | `200` + `List<String>` | `404`（用户不存在，`ApiResponse`） |

---

## 错误响应语义

内部 API 涉及 `ApiResponse` 的错误场景，统一字段：

- `code`: 业务错误码（如 `400`、`404`、`409`）
- `message`: 可读错误信息
- `timestamp`: 服务端时间戳

示例（创建用户冲突）：

```json
{
  "code": 409,
  "message": "用户名已存在: duplicated",
  "timestamp": "2026-04-09T16:00:00"
}
```

---

## 调用方可靠性策略（由 koduck-auth 承担）

`koduck-user` 作为被调用方，不在服务内实现调用重试或熔断；调用链可靠性由 `koduck-auth` 客户端负责：

1. **超时**:
   - 单次请求超时由 `koduck-auth` 配置 `client.user_service_timeout_secs` 控制（默认 `10` 秒）
2. **重试**:
   - 不对 `4xx` 做重试
   - 仅对可判定的网络瞬时错误/超时考虑有限重试（建议最多 `2` 次，指数退避）
   - 非幂等写请求（`POST /internal/users`）默认不自动重试，避免重复创建语义风险
3. **熔断**:
   - 由调用方（或网关层）实现，`koduck-user` 仅返回明确状态码与错误体

---

## 回归测试覆盖（koduck-user 侧）

测试文件：

- `koduck-user/src/test/java/com/koduck/controller/user/InternalUserControllerTest.java`

覆盖点：

- 用户不存在（lookup / last-login / roles / permissions）
- 用户创建冲突（username/email）
- 登录后更新时间/IP
- 角色和权限查询
- 校验失败与错误响应结构断言
