# koduck-knowledge 设计（Read-Only Fact Query Service）

## 1. 背景与目标

本设计用于承接 `koduck-knowledge` 独立项目的“实体知识”能力。当前阶段核心目标：

- 先落地“人和 domain 的关联”事实查询能力。
- 强制实体标准化（名称匹配 / Entity Linking 内核），保证查询阶段始终围绕稳定的 `entity_id` 工作。
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
6. 数据存储采用**独立 PostgreSQL 库**，并配合 S3 协议对象存储存放事实分片；
   本地如需对象路径样例，可选使用 MinIO。
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
- **Query API Layer**：由 `koduck-knowledge` 提供，负责名称匹配后的 search、详情读取、历史读取与批量事实返回。
- **Northbound Gateway（APISIX）**：通过现有 APISIX route-init 机制显式注册
  `/api/v1/entities/*` 路由，将外部流量转发到 `koduck-knowledge`，并对齐仓库现有受保护
  API 的鉴权方式：`jwt-auth + proxy-rewrite(headers.set)`，统一注入 `X-User-Id`、
  `X-Username`、`X-Roles`、`X-Tenant-Id`，避免请求落入已有的 `/api/* -> backend`
  通配路由。

## 4.1 服务外部消费契约（MVP 定稿）

为保证当前 MVP 可落地但不把事实构建链路混入服务运行时，当前阶段只锁定
`koduck-knowledge` 的消费契约，不定义服务内的数据构建流程编排。

消费契约包含以下内容：

- PostgreSQL 表结构、字段语义与只读查询约束。
- `domain_dict` 与 `profile_entry_dict` 的 MVP 最小种子集合。
- Blob 对象路径规范与 JSON 最小结构。
- 用于集成测试与联调的最小示例数据集。

当前不在本设计中展开：

- 离线构建任务调度方式。
- 外部灌库工具实现细节。
- 人工修数流程或数据治理工作台。

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

说明：

- `domain_class` 表示知识域（knowledge domain），不是实体类型。
- 当前 MVP 中实体类型与知识域显式区分：`entity.type` 表示 `person` 等实体类型，
  `domain_class` 表示 `finance` 等知识域。
- `canonical_name` 与 `entity_name` 语义显式区分：`canonical_name` 为稳定规范名，
  `entity_name` 为该时态段展示名，允许不同。

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
- 查询时基于别名、规范名与 `domainClass` 做实体标准化
- 仅当命中 `entity_id` 且能定位到满足条件的 `basic_profile` 时，才对外返回结果

MVP 阶段的标准化与排序规则固定如下：

- 先做 `trim`、大小写折叠与全半角统一。
- 候选来源仅包含 `entity.canonical_name` 与 `entity_alias.alias`。
- 排序规则固定为：`canonical` 完全匹配 > `alias` 完全匹配 >
  `canonical` 前缀匹配 > `alias` 前缀匹配。
- MVP 不引入编辑距离、拼音近似或向量召回等模糊匹配。
- `matchType` 固定使用以下枚举：
  - `CANONICAL_EXACT`
  - `ALIAS_EXACT`
  - `CANONICAL_PREFIX`
  - `ALIAS_PREFIX`
- 若多个候选同分，按 `entity_id` 升序稳定返回，保证结果可复现。

效果：

- 同名异写归一
- 同名异人保留为多候选，避免过早唯一化
- 查询接口对调用方始终返回稳定的实体标识

## 7. 查询链路（Facts First, Read Only）

1. 调用方提交 `name + domainClass + at?`，服务先基于 `canonical_name` 与 `alias`
   执行名称匹配。
2. 名称命中后，服务必须继续定位该 `entity_id` 在指定 `domainClass + at` 下有效的
   `basic_profile`。
3. 仅当“名称匹配 + basic_profile 命中”两项同时满足时，`search`
   才返回该实体结果；任一条件不满足则该实体不返回。
4. 调用方若需要更多事实，再按 `entity_id` 读取详情分片或历史版本。
5. 当前阶段仅做“人和 domain”关联检索，动态关系推理暂不纳入实现范围。

当前返回契约补充如下：

- `facts/detail/history` 接口默认返回原始 `s3://...` URI 与元信息，不返回 presigned URL。
- blob 对象存在性不由 `koduck-knowledge` 运行时探测；服务默认信任数据库中已经装载好的 URI。
- 当前 MVP 仅提供 `S3Uri` / `BlobLocation` 一类值对象，用于 `s3://...` URI 的解析、
  封装与协议边界收口；`BlobStore` 名称保留给未来真正需要对象存储 I/O 时再引入。
- 当前 MVP 查询链路不直接访问对象存储，也不在运行时生成 presigned URL。
- `facts` 接口响应保持扁平数组，不按 `entity_id` 嵌套分组。
- 所有带可选 `at` 的查询接口在未传 `at` 时，统一按请求处理时刻的 `now()` 解释。
- `GET /api/v1/entities/actions/search` 中 `domainClass` 为必填参数。
- 所有出现 `domainClass` 的接口都必须先按 `domain_dict` 校验；缺失或未知值统一返回 `400`。
- `GET /api/v1/entities/actions/search` 按“命中路径逐条返回”：
  若同一 `entity_id` 同时命中多条名称匹配路径，则允许返回多条 `SearchHit`，
  不在服务内做按 `entity_id` 去重。
- `POST /api/v1/entities/actions/facts` 请求体固定为
  `{ entityIds, domainClass, at?, profileEntryCodes? }`；`domainClass` 为必填；未传
  `profileEntryCodes` 时只返回 basic facts，传入时仅按请求追加对应 non-basic detail
  元信息。
- `POST /api/v1/entities/actions/facts` 采用“按实体全满足才返回”的规则：
  对每个请求的 `entity_id`，必须先命中当前 `domainClass + at` 下有效的
  basic fact；若传入 `profileEntryCodes`，则这些 non-basic entry 也必须全部命中；
  否则该 `entity_id` 整体不返回任何记录。
- 历史接口统一使用 `page` + `size` 分页，并返回
  `{ items, page, size, total }` 结构。
- history 接口中的 `total` 表示分页过滤后、实际可返回给调用方的记录总数。
- 历史接口分页规则固定为：`page` 从 `1` 开始，默认 `page=1,size=20`，`size`
  最大为 `100`，非法分页参数返回 `400`。
- 单对象读取接口在资源不存在或当前时态无命中时返回 `404`；
  历史接口在无命中时返回 `200` 且 `items=[]`。
- `profiles/{entry_code}` 及其 history 路径中的 `entry_code` 固定使用大写字典 code；
  未知 `entry_code` 返回 `404`，使用 `BASIC` 调用 detail/history 路径返回 `400`。
- 字典解析责任固定在 service 层：controller 接收 `domainClass`、`entry_code` 与
  `profileEntryCodes` 字符串，service 先查 `domain_dict` 与 `profile_entry_dict`
  完成校验与解析，再调用 repository 的只读查询。
- 对外 API 中单值知识域参数统一命名为 `domainClass`。
- 所有 `4xx` 错误响应统一使用最小模型 `{ code, message, details? }`；
  其中 `details` 仅在参数校验失败等需要补充上下文时出现。

## 7.1 Blob 最小结构（MVP 定稿）

Blob 仅存结构化 JSON，不在接口层直接回传完整内容。MVP 统一包含 `schemaVersion`
字段，便于后续平滑演进。

`basic_profile` 对应 JSON 最小结构：

```json
{
  "schemaVersion": 1,
  "entityId": 123,
  "domainClass": "finance",
  "entryCode": "BASIC"
}
```

约束：

- `basic_profile` 只承载最小元信息，不承载 `summary`、正文摘要或其他详情内容。

`entity_profile` 对应 JSON 最小结构：

```json
{
  "schemaVersion": 1,
  "entityId": 123,
  "entryCode": "BIO",
  "version": 1,
  "content": {}
}
```

对象路径规范固定为：

- `basic_profile`：
  `s3://<bucket>/<prefix>/<entity_id>/<entry_code>/<valid_from>.json`
- `entity_profile`：
  `s3://<bucket>/<prefix>/<entity_id>/<entry_code>/<version>.json`

其中 `basic_profile` 路径中的 `valid_from` 固定编码为 UTC ISO 基础格式：

- `yyyyMMdd'T'HHmmss'Z'`
- 例如：`20260417T120000Z`

## 7.2 最小示例数据集（MVP 定稿）

用于集成测试与联调的基线样例至少包含以下 5 类场景：

- 单实体 `canonical` 完全命中。
- 同名异人多候选命中。
- `entity_basic_profile` 多段历史，至少包含一段开放段与一段闭合段。
- `entity_profile` 多版本历史。
- 缺失 blob 的外部数据前置条件说明样例。

## 8. 服务边界

### 8.1 当前服务提供什么

- `Search` 名称匹配 + `basic_profile` 命中查询
- `Basic Profile` 读取
- `Detail Profile` 读取
- `History` 历史版本读取
- 批量事实查询接口
- 只读 blob 元信息读取与 raw URI 返回

### 8.2 当前服务不提供什么

- 候选区
- 判定回写接口
- 人工审核接口
- 发布接口
- 任何运行时插入、更新、删除能力
- 事实构建与导入流程
- 运行时 blob 写入、删除与内容分发
- 默认不对外提供 presigned URL 分发能力

### 8.3 数据维护责任

- `koduck-knowledge` 运行时只消费已经存在的数据。
- 数据的构建、对账、灌库、纠错由服务外部承担。
- 若未来需要写入链路，应单独立项，不在当前 MVP 内混入。
- 跨表业务规则如 `is_basic` 错表写入校验由外部装载流程与应用层共同保证，不依赖物理 FK。
- `entity_basic_profile` 的开放段唯一、时间段不重叠等时态正确性由服务外部保证；
  `koduck-knowledge` 只负责按既有数据返回，不负责治理、修复或裁剪异常重叠段。
- 当前服务消费契约假设同一 `(entity_id, domain_class, at)` 至多命中一段有效
  `entity_basic_profile`。
- 运行时若查询接口未显式传入 `at`，服务使用 `now()` 作为时态点执行读取，不要求调用方补传。
- blob 对象存在性由服务外部数据装载契约保证，不由 `koduck-knowledge` 运行时校验。
- 当前服务消费契约默认假设：凡是写入数据库并暴露到查询接口的 blob URI，都已由外部流程保证可用。

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

1. 先落独立 PostgreSQL + S3 协议对象存储的只读事实模型；本地 MinIO 仅作为可选样例。
2. 实现 `entity`、`entity_alias`、`entity_basic_profile`、`entity_profile` 的查询链路。
3. 提供 `search/detail/history` 读接口与批量事实接口。
4. 在 APISIX route-init 中注册 `/api/v1/entities/*` 显式路由，并对齐 `jwt-auth +
  proxy-rewrite` 的受保护 API 基线，验证不会命中 `/api/* -> backend` 通配路由。
5. 同步定稿最小字典种子、blob JSON 结构与示例数据集，保证接口验收有统一基线。
6. 建立日志、指标、压测基线，保证只读服务的稳定性。

---

该设计遵循“事实优先、查询只读、边界清晰”的原则。当前阶段优先把事实读取与返回做稳定，把数据构建与导入明确留在服务外部。
