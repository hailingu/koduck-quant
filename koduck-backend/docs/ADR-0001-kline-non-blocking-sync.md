# ADR-0001: K-line 查询改为非阻塞同步触发

- Status: Accepted
- Date: 2026-04-01
- Issue: #292

## Context

`GET /api/v1/market/stocks/{symbol}/kline` 在数据未命中时会触发 `klineSyncService.requestSyncSymbolKline(...)`。
在本决策前，控制器通过 `waitForKlineData()` 使用 `Thread.sleep(500)` 轮询最多 8 次（约 4 秒）等待数据回填。

该实现会占用请求线程，带来以下问题：
- 并发场景下吞吐下降，线程池占用增加。
- 接口尾延迟升高，且等待时间不可预测。
- 控制器层承担了不必要的等待重试逻辑。

## Decision

将 K-line 接口改为非阻塞流程：
- 若查询到 K-line 数据：返回 `200 OK` + 数据。
- 若未查询到数据且异步同步触发成功：立即返回 `202 Accepted` + 空列表，message 为 `K-line sync accepted; data is being prepared`。
- 若未查询到数据且同步未触发：保持 `200 OK` + 空列表。

## Consequences

正向影响：
- 移除阻塞轮询，避免单请求最多约 4 秒的线程占用。
- 接口行为更符合异步任务语义（Accepted）。
- 控制器职责更聚焦于请求编排，不承担等待策略。

代价与影响：
- 客户端需要处理 `202` 分支并在后续查询中获取结果。
- 接口行为从“可能慢返回 200”变为“快速返回 202/200”，属于兼容性关注点。

## Alternatives Considered

1. 保持轮询等待
- 拒绝：仍有线程阻塞问题，无法满足性能与扩展性目标。

2. 全链路 WebFlux/Reactive 改造
- 暂不采用：改动面过大，不符合本次缺陷修复的最小变更策略。

3. 202 + 任务 ID 查询接口
- 可作为后续演进方向；本次先采用最小改动，复用现有查询路径。

## Verification

- 为控制器补充了用例：
  - 已有数据返回 `200`。
  - 触发异步同步时返回 `202`。
- 集成测试对空结果路径放宽为 `2xx`，兼容 `200/202` 语义。
