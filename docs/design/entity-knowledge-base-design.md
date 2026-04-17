# koduck-knowledge 设计（Read-Only Fact Query Service）

## 1. 背景与目标

本设计用于承接 `koduck-knowledge` 独立项目的“实体知识”能力。当前阶段核心目标：

- 先落地“人和 domain 的关联”事实查询能力。
- 强制实体标准化（Entity Linking），保证查询阶段始终围绕稳定的 `entity_id` 工作。
- 对外提供资源化查询接口，返回结构化事实与 profile 元信息。

当前边界同时明确如下：

- 事实构建、清洗、审核、导入不在 `koduck-knowledge` 服务本身提供。
- 不建设“候选 → 判定 → 审核 → 发布”的运行时治理链。
- 服务形态保持资源化 API，但 MVP 只实现 **Read**，不开放 Create / Update / Delete。

## 2. 关键结论

1. 该能力作为独立知识库能力建设。
2. 先排除向量数据库方案。
3. 先排除 PHP 技术栈方案。
4. 不采用“静态图谱边 + 单一 weight”作为主模型。
5. 长期策略：**存事实，不存最终关系结论**；关系强弱按查询上下文动态推理。
6. 数据存储采用**独立 PostgreSQL 库**，并配合 S3/MinIO 存放事实分片。
7. `koduck-knowledge` 当前只承担查询与返回职责，不承担事实写入职责。
8. 数据装载由外部离线流程、数据构建服务或运维脚本负责，不作为服务运行时能力。

## 3. 为什么不采用静态关系边权重

单一边权无法表达时序波动，例如：

- A-B 在 1 月强关联
- 2 月弱关联
- 3 月再次强关联

因此不能仅依赖 `(A,B,weight)` 静态边模型。关系强度必须由“事实 + 时间窗 + 方面 + 当前上下文”动态计算。

## 4. 总体架构

- **Knowledge Base（主存）**：独立 PostgreSQL 库 + S3（实体资料），负责存储已构建好的事实并对外提供只读查询。
- **Data Builder / Loader（外部）**：负责事实构建、清洗、审核、导入，不属于 `koduck-knowledge` 服务运行时。
- **Query API Layer**：由 `koduck-knowledge` 提供，负责 entity linking、候选召回、详情读取、历史读取与批量事实返回。
- **Northbound Gateway（APISIX）**：通过现有 APISIX route-init 机制显式注册
  `/api/v1/entities/*` 路由，将外部流量转发到 `koduck-knowledge`，并对齐仓库现有受保护
  API 的鉴权方式：`jwt-auth + proxy-rewrite(headers.set)`，统一注入 `X-User-Id`、
  `X-Username`、`X-Roles`、`X-Tenant-Id`，避免请求落入已有的 `/api/* -> backend`
  通配路由。

## 5. 数据模型（当前范围）

### 5.1 实体主表：`entity`

用途：提供稳定的实体主键与规范主名。

建议字段：

- `entity_id`
- `canonical_name`
- `type`
- `created_at`

### 5.2 实体别名表：`entity_alias`

用途：支撑查询阶段的 Entity Linking 与多候选召回。

建议字段：

- `alias_id`
- `entity_id`
- `alias`
- `lang`
- `source`

说明：同一 `alias + lang` 可以映射多个 `entity_id`，用于保留同名异人场景。

### 5.3 实体基础信息表：`entity_basic_profile`

用途：承载“人和 domain 的关联”主入口，用于实体召回与返回基础事实。

建议字段：

- `entity_id`
- `entity_name`
- `domain_class`
- `valid_from`
- `valid_to`
- `basic_profile_entry_id`
- `basic_profile_s3_uri`

### 5.4 实体详情分片表：`entity_profile`

用途：承载实体多维详情（传记、荣誉、定义等）及其历史版本。

建议字段：

- `profile_id`
- `entity_id`
- `profile_entry_id`
- `blob_uri`
- `version`
- `is_current`
- `loaded_at`

约束建议：

- 同一 `(entity_id, profile_entry_id)` 只允许一条 `is_current = true`。
- 通过 `version` 保留历史，不覆盖旧值。

### 5.5 暂缓项：事实表（`fact_store`）

当前阶段先不考虑 `fact_store`，不进入实现范围。

## 6. 实体标准化（查询时必须项）

查询阶段必须先完成实体标准化：

- 输入保留原始 `surface`
- 查询时基于别名、规范名与 domain 提示做 Entity Linking
- 输出候选 `entity_id`、匹配类型与置信度

效果：

- 同名异写归一
- 同名异人保留为多候选，避免过早唯一化
- 查询接口对调用方始终返回稳定的实体标识

## 7. 查询链路（Facts First, Read Only）

1. 调用方提交 `surface + domainClass + context`，服务先执行 Entity Linking。
2. 若命中多个 `entity_id`，服务保留全部候选，不在服务内做最终裁剪。
3. 服务返回候选实体及其 `basic_profile` 元信息。
4. 调用方若需要更多事实，再按 `entity_id` 读取详情分片或历史版本。
5. 当前阶段仅做“人和 domain”关联检索，动态关系推理暂不纳入实现范围。

## 8. 服务边界

### 8.1 当前服务提供什么

- `Entity Linking` 查询
- `Search` 候选召回
- `Basic Profile` 读取
- `Detail Profile` 读取
- `History` 历史版本读取
- 批量事实查询接口

### 8.2 当前服务不提供什么

- 候选区
- 判定回写接口
- 人工审核接口
- 发布接口
- 任何运行时插入、更新、删除能力
- 事实构建与导入流程

### 8.3 数据维护责任

- `koduck-knowledge` 运行时只消费已经存在的数据。
- 数据的构建、对账、灌库、纠错由服务外部承担。
- 若未来需要写入链路，应单独立项，不在当前 MVP 内混入。

### 8.4 网关暴露责任

- `koduck-knowledge` 的 northbound HTTP 入口通过 APISIX 暴露，不直接以裸 Service
  作为对外入口。
- 需在 dev/prod 的 APISIX route-init Job 中新增显式 knowledge 路由，建议固化为
  `uri=/api/v1/entities/*`。
- knowledge 路由优先级必须高于当前通配 `/api/* -> backend` 路由，避免被错误转发。
- knowledge 路由鉴权方式需与现有受保护 API 对齐：启用 `jwt-auth`，不走匿名访问，也不以
  服务侧自行解析外部 JWT 作为主路径。
- 网关侧通过 `proxy-rewrite(headers.set)` 注入 `X-User-Id=$jwt_claim_sub`、
  `X-Username=$jwt_claim_username`、`X-Roles=$jwt_claim_roles`、
  `X-Tenant-Id=$jwt_claim_tenant_id`，由下游服务消费这些身份头。

## 9. 现阶段实施建议（MVP）

1. 先落独立 PostgreSQL + S3/MinIO 的只读事实模型。
2. 实现 `entity`、`entity_alias`、`entity_basic_profile`、`entity_profile` 的查询链路。
3. 提供 `link/search/detail/history` 读接口与批量事实接口。
4. 在 APISIX route-init 中注册 `/api/v1/entities/*` 显式路由，并对齐 `jwt-auth +
  proxy-rewrite` 的受保护 API 基线，验证不会命中 `/api/* -> backend` 通配路由。
5. 建立日志、指标、压测基线，保证只读服务的稳定性。

---

该设计遵循“事实优先、查询只读、边界清晰”的原则。当前阶段优先把事实读取与返回做稳定，把数据构建与导入明确留在服务外部。
