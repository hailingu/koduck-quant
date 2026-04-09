# ADR-0001: 前端登录通过 APISIX 对接 koduck-auth

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: `koduck-auth/docs/design/koduck-auth-user-service-design.md`, `koduck-user/docs/design/koduck-user-jwt-design.md`

---

## 背景与问题陈述

`koduck-frontend` 需要实现登录页面并对接认证服务。当前存在两个实现方向：

1. 前端直接调用 `koduck-auth` 服务地址（绕过网关）
2. 前端统一通过 APISIX 网关调用认证接口（`/api/v1/auth/*`）

我们需要统一入口、减少前端环境差异，并与后端网关鉴权策略保持一致。

---

## 决策驱动因素

1. **统一入口**: 前端只维护一个 API Base URL。
2. **安全边界**: 路由、限流、鉴权策略应集中在 APISIX 层。
3. **环境一致性**: 本地/dev/prod 尽量保持同构访问路径。
4. **可运维性**: 便于在网关层做审计、灰度和故障切换。

---

## 考虑的选项

### 选项 1: 前端直连 koduck-auth

**优点**:
- 开发接线简单

**缺点**:
- 暴露内部服务地址
- 环境切换复杂
- 绕过网关治理能力

### 选项 2: 前端通过 APISIX 调用 koduck-auth（选定）

**优点**:
- 前端入口统一
- 与现有网关路由设计一致
- 便于后续扩展（限流、观测、灰度）

**缺点**:
- 依赖 APISIX 路由配置正确性

---

## 决策结果

采用 **选项 2**：前端登录接口统一走 APISIX。

### 拓扑结论

- 从**请求链路**看：`Browser -> APISIX -> koduck-auth`
- 从**部署暴露**看：`koduck-frontend` 与 `koduck-auth` 都位于 APISIX 后面，由 APISIX 对外暴露

也就是说，`koduck-frontend` 不应放在 APISIX 前面直连 `koduck-auth`。

---

## 实施细节

### 前端约定

- 登录请求路径：`POST /api/v1/auth/login`
- API Base URL 指向 APISIX（例如 dev 下 `http://127.0.0.1:19080`）
- 不在前端硬编码 `koduck-auth` 内网地址

### 配置建议

- 使用环境变量管理 API 网关地址（如 `VITE_API_BASE_URL`）
- dev/prod 仅切换网关地址，不改业务路径

---

## 相关文档

- [koduck-auth-user-service-design.md](../../../koduck-auth/docs/design/koduck-auth-user-service-design.md)
- [koduck-user-jwt-design.md](../../../koduck-user/docs/design/koduck-user-jwt-design.md)

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
