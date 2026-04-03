# Controller 冗余分析报告

> 分析日期：2026-04-03
> 分析范围：`koduck-backend/src/main/java/com/koduck/controller/`

## 🔴 完全冗余的 Controller（可安全删除）

### 1. `AShareController.java` — 100% 冗余

所有 3 个端点都是其他 Controller 的子集（硬编码 `market=AShare`）：

| AShareController 端点 | 等价的真实端点 | 差异 |
|---|---|---|
| `GET /api/v1/a-share/search` | `GET /api/v1/market/search` (MarketController) | **完全相同**，调用同一个 `marketService.searchSymbols()` |
| `GET /api/v1/a-share/kline` | `GET /api/v1/kline` (KlineController) | AShare 硬编码了 `MarketConstants.DEFAULT_MARKET`，KlineController 更通用 |
| `GET /api/v1/a-share/kline/price` | `GET /api/v1/kline/price` (KlineController) | 同上 |

此外，`AShareController.LatestPriceResponse` 和 `KlineController.LatestPriceResponse` 是**完全相同的 record**（`String symbol, BigDecimal price`），属于重复定义。

**结论**：AShareController 是一个便捷路由层，所有功能已被 MarketController + KlineController 完全覆盖。如果前端需要 A 股专用路径，应通过前端路由或网关层转发，而非维护冗余 Controller。

---

### 2. `ProfileController.java` — 100% 冗余（空壳）

所有 5 个端点都是 **stub 实现**（返回空 builder）：

| ProfileController 端点 | 实际实现位置 | 冗余类型 |
|---|---|---|
| `GET /api/v1/profile` | `GET /api/v1/users/me` (UserController) | 真实实现已在 UserController |
| `PUT /api/v1/profile` | `PUT /api/v1/users/me` (UserController) | 真实实现已在 UserController |
| `POST /api/v1/profile/avatar` | 无实际实现 | 空壳，未接入任何存储 |
| `GET /api/v1/profile/preferences` | `GET /api/v1/settings` (SettingsController) | 真实实现已在 SettingsController |
| `PUT /api/v1/profile/preferences` | `PUT /api/v1/settings` (SettingsController) | 真实实现已在 SettingsController |

**结论**：ProfileController 是早期占位代码，其功能已被 UserController（资料管理）和 SettingsController（偏好设置）完全替代。所有方法返回空对象，无业务价值。

---

## 🟡 部分冗余（需要权衡）

### 3. `KlineController.java` vs `MarketController.getStockKline()`

| 对比维度 | KlineController | MarketController |
|---|---|---|
| URL | `GET /api/v1/kline` | `GET /api/v1/market/stocks/{symbol}/kline` |
| 参数 | 需传 `market` | `market` 作为可选参数（默认 AShare） |
| 额外功能 | 无 | 有 K 线数据为空时自动触发异步同步（返回 202） |
| 依赖 | 仅 KlineService | KlineService + KlineSyncService |

**建议**：KlineController 的 `GET /` 端点与 MarketController 存在功能重叠，但 KlineController 作为通用底层 API 保留也是合理的（供其他服务内部调用）。如果保留，应删除 `GET /price` 端点（MarketAdvancedController 的批量报价和 MarketController 的股票详情已覆盖此场景）。

---

## ✅ 无冗余的 Controller

以下 Controller 职责清晰、无重复：

| Controller | 职责 | 端点数 |
|---|---|---|
| `AuthController` | 认证登录注册 | 7 |
| `BacktestController` | 回测执行与结果 | 5 |
| `CommunitySignalController` | 社区信号 | 19 |
| `CredentialController` | API 凭证管理 | 9 |
| `HealthController` | 健康检查 | 2 |
| `MarketController` | 市场数据基础 | 10 |
| `MarketAdvancedController` | 市场高级数据 | 12 |
| `MonitoringController` | 监控告警 | 18 |
| `PortfolioController` | 投资组合 | 7 |
| `SentimentController` | 市场情绪 | 2 |
| `SettingsController` | 用户设置 | 4 |
| `StrategyController` | 策略管理 | 10 |
| `TechnicalIndicatorController` | 技术指标 | 2 |
| `UserController` | 用户管理 | 7 |
| `WatchlistController` | 自选股 | 5 |
| `WebSocketEventController` | WebSocket 实时推送 | 3 + 3 events |
| `admin/KlineAdminController` | K 线管理（Admin） | 3 |

---

## 📋 建议操作

1. **删除 `AShareController.java`**：前端调用迁移到 `/api/v1/market/search` 和 `/api/v1/kline`
2. **删除 `ProfileController.java`**：前端调用迁移到 `/api/v1/users/me` 和 `/api/v1/settings`
3. **合并重复的 `LatestPriceResponse`**：提取到 `dto/market/` 包中作为共享 DTO
4. **评估 KlineController 存留**：如仅前端使用，可合并到 MarketController；如作为服务间 API，可保留但标记为内部接口