# ADR-0046: Controller 层冗余消除

- Status: Accepted
- Date: 2026-04-03
- Issue: #384

## Context

根据 `docs/controller-redundancy-analysis.md` 分析报告，koduck-backend 的 Controller 层存在完全冗余的 Controller，增加了维护成本。

### 发现的冗余问题

| 严重程度 | 冗余对象 | 原因 |
|---------|---------|------|
| 🔴 完全冗余 | `AShareController` | 所有端点都是其他 Controller 的子集，功能被 MarketController + KlineController 完全覆盖 |
| 🔴 完全冗余 | `ProfileController` | 所有端点都是 stub 实现，功能已被 UserController + SettingsController 替代 |
| 🔴 重复定义 | `LatestPriceResponse` | AShareController 和 KlineController 中定义完全相同的 record |

## Decision

### 决策 1: 删除 `AShareController`

**理由**:
- 所有 3 个端点都是其他 Controller 的子集
- `GET /api/v1/a-share/search` → `GET /api/v1/market/search` (MarketController)
- `GET /api/v1/a-share/kline` → `GET /api/v1/kline` (KlineController)
- `GET /api/v1/a-share/kline/price` → `GET /api/v1/kline/price` (KlineController)
- 如果前端需要 A 股专用路径，应通过前端路由或网关层转发

**实施方案**:
- 删除 `AShareController.java`

### 决策 2: 删除 `ProfileController`

**理由**:
- 所有 5 个端点都是 stub 实现（返回空 builder）
- `GET /api/v1/profile` → `GET /api/v1/users/me` (UserController)
- `PUT /api/v1/profile` → `PUT /api/v1/users/me` (UserController)
- `GET /api/v1/profile/preferences` → `GET /api/v1/settings` (SettingsController)
- `PUT /api/v1/profile/preferences` → `PUT /api/v1/settings` (SettingsController)
- 是早期占位代码，无业务价值

**实施方案**:
- 删除 `ProfileController.java`

### 决策 3: 提取 `LatestPriceResponse` 为共享 DTO

**理由**:
- AShareController 和 KlineController 中定义完全相同的 record
- 提取为共享 DTO 可以消除重复定义
- 放在 `dto/market/` 包中，符合领域组织

**实施方案**:
- 创建 `dto/market/LatestPriceResponse.java`
- 更新 `KlineController` 引用新的共享 DTO

## Consequences

### 正向影响

- 消除代码重复，降低维护成本
- 统一 API 入口，减少混淆
- 删除无业务价值的空壳代码

### 消极影响

- 前端如果直接调用 `/api/v1/a-share/*` 路径，需要迁移到新的端点
- 如果前端调用 `/api/v1/profile/*` 路径，需要迁移到 `/api/v1/users/me` 或 `/api/v1/settings`

### 兼容性

| 方面 | 影响 | 说明 |
|-----|------|------|
| API 接口 | 有 | 删除 `/api/v1/a-share/*` 和 `/api/v1/profile/*` 路径 |
| 前端调用 | 有 | 需要迁移到新的端点 |
| 业务逻辑 | 无 | 功能已在其他 Controller 实现 |
| 测试 | 有 | 需要删除相关测试文件 |

## Related

- Issue #384
- `docs/controller-redundancy-analysis.md`
