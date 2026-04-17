# Koduck Knowledge 性能基线

日期：2026-04-17

## 范围

本报告记录 `koduck-knowledge` MVP 的首版性能基线，覆盖以下接口：

- `GET /api/v1/entities/actions/search`
- `POST /api/v1/entities/actions/facts`
- `GET /api/v1/entities/{id}/profiles/{entry_code}`

## 方法

- 运行模式：本地 JVM / PostgreSQL Testcontainers fixture
- 数据规模：小型 fixture（同名异人、basic profile、detail history）
- 目标：先确认读链路没有明显慢查询与排序退化，再为 dev 环境扩容预留阈值

## 当前观察

- `search`：主要成本在 canonical/alias exact + prefix 查询，以及命中后读取当前 basic profile
- `facts`：主要成本在批量 `entityId` 遍历与 detail profile 回查
- `profile detail`：主要成本在字典解析与 current profile 单条查询

## 目标阈值

- `GET /entities/actions/search` P95 ≤ 100ms
- `POST /entities/actions/facts` P95 ≤ 150ms
- `GET /entities/{id}/profiles/{entry_code}` P95 ≤ 50ms

## 扩容与优化项

- 当 `knowledge_search_latency_ms` 持续接近 100ms P95 时，优先检查 canonical/alias 索引与 prefix 查询命中率
- 当 `knowledge_query_throughput` 上升且 `facts` 接近 150ms P95 时，优先考虑批量查询收敛和只读副本扩容
- 当 detail/history 查询放大时，优先补充 `entity_id + profile_entry_id + is_current` 与历史分页索引检查

## 备注

本版基线先作为 Phase 3 文档占位与阈值约束；真实 dev 环境压测结果需要在服务镜像与 APISIX 路由部署完成后补录。
