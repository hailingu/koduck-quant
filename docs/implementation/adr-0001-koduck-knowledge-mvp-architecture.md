# ADR-0001：koduck-knowledge MVP 架构与数据模型

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-17
- **作者**: @guhailin
- **相关**: `docs/design/entity-knowledge-base-design.md`

---

## 背景与问题陈述

`docs/design/entity-knowledge-base-design.md` 已将 `koduck-knowledge` 收口为独立的实体事实查询服务。
当前 MVP 只要求把“人 × domain 关联”的事实读取链路跑通：
查询时完成名称匹配，并以资源化 API 返回基础事实、详情分片与历史信息。

本次收口后的核心前提如下：

1. `koduck-knowledge` 当前不承担事实构建、审核、导入职责。
2. 不在服务内建设“候选 → 判定 → 审核 → 发布”的运行时治理链。
3. 服务保持 CRUD 风格资源边界，但 MVP 只实现 **Read**。
4. 数据由服务外部的离线流程、数据构建服务或运维脚本准备后写入库表。

原设计在以下点需要重新定稿：

1. 技术栈未定。
2. 存储只写了 PostgreSQL，未明确对象存储与本地同构方案。
3. `entity_basic_profile` 与 `entity_profile` 的职责边界未完全锁定。
4. 同名异人场景是否允许保留多候选未完全定稿。
5. 构建、日志、部署、k8s 接入方式未完全定稿。
6. 当前只读服务边界与外部数据装载责任需要单独写清楚。

本 ADR 锁定当前 MVP 架构结论，作为后续实现与评审依据。

### 上下文

- 业务背景：需要围绕“实体 × domain”提供稳定的事实查询能力，为下游推理或应用编排提供原始事实输入。
- 技术背景：仓库现有服务主要使用 Java 与 Rust；本地开发环境 `koduck-dev` 已提供
  MinIO（S3 兼容），但当前 MVP 不把它作为启动或部署前置条件。

---

## 决策驱动因素

1. **边界清晰优先**：当前阶段先把事实查询服务做好，不把事实构建与治理链混入。
2. **查询稳定优先**：名称匹配、基础事实返回、详情读取、历史读取要先形成闭环。
3. **与仓库技术栈协同**：降低引入新栈的学习与运维成本。
4. **协议同构优先**：统一采用 S3 协议对象路径；本地如需样例可选使用 MinIO，生产对接 S3 兼容对象存储。
5. **职责清晰**：基础事实入口与详情分片职责分离，不重复。
6. **保留扩展性**：当前只读，但 schema 与 API 设计不阻断未来引入独立写入链路。
7. **网关一致性**：northbound HTTP 入口应复用仓库现有 APISIX 注册、鉴权与身份头透传基线。
8. **消费契约先行**：先锁定服务消费的数据契约、最小 blob 结构与示例数据集，再推进实现。

---

## 考虑的选项

### D1. 技术栈

- **选项 A**：Java (Spring Boot) + 独立 Postgres。
- **选项 B**：Rust + 独立 Postgres。
- **选项 C**：Python + 独立 Postgres。

### D2. Blob 存储

- **选项 A**：直接依赖 AWS S3。
- **选项 B**：统一采用 S3 协议对象存储；本地如需样例可选使用 MinIO，生产接真实 S3
  或兼容对象存储。

### D3. `entity_basic_profile` 与 `entity_profile` 的关系

- **选项 A**：合并为单表。
- **选项 B**：保留两表，`entity_basic_profile` 承载召回所需基础事实，`entity_profile` 承载非 basic 详情分片。

### D4. `entity_profile` 历史模型

- **选项 A**：代理主键 `profile_id` + `version` + 部分唯一 `is_current`。
- **选项 B**：现表 + 历史表分离。
- **选项 C**：仅保留最新值，不保留历史。

### D5. `entity_basic_profile` 是否允许多段历史

- **选项 A**：同一 `(entity_id, domain_class)` 仅一行。
- **选项 B**：允许多段时间历史，使用 `valid_from` 参与主键。

### D6. 与 `koduck-backend` 的耦合边界

- **选项 A**：作为 `koduck-backend` 子模块。
- **选项 B**：独立顶层项目，只共享公共 Maven 依赖。

### D7. 日志方案

- **选项 A**：slf4j + logback。
- **选项 B**：slf4j + log4j2 + JSON 格式。

### D8. 构建与部署形态

- **选项 A**：传统 JVM Jar + JRE 基础镜像。
- **选项 B**：GraalVM Native Image 作为默认发布形态。

### D9. k8s 接入

- **选项 A**：服务私有 deploy/uninstall 脚本。
- **选项 B**：接入仓库现有 `k8s/deploy.sh` 与 `k8s/uninstall.sh`。

### D10. API 文档方案

- **选项 A**：手写 Markdown API 文档。
- **选项 B**：集成 springdoc-openapi / Swagger UI。

### D11. 构建方式

- **选项 A**：允许本地裸机构建发布产物。
- **选项 B**：统一在 Docker 容器内构建。

### D12. 运行时写入职责

- **选项 A**：`koduck-knowledge` 同时提供写入、审核、发布接口。
- **选项 B**：`koduck-knowledge` 当前只提供读查询接口，数据装载职责留在服务外部。

### D13. 跨表外键策略

- **选项 A**：建立物理外键。
- **选项 B**：所有跨表引用均为逻辑引用，不建立物理 FK。

### D14. 服务外部数据契约范围

- **选项 A**：只定义服务消费契约，不定义离线构建流程。
- **选项 B**：连同离线构建流程一并定稿。

### D15. BlobStore 运行时职责

- **选项 A**：MVP 运行时完全不接 `BlobStore`，只把 URI 当字符串返回。
- **选项 B**：保留 `BlobStore` 抽象，但运行时只做 URI 解析/封装，不访问对象存储。
- **选项 C**：当前 Phase 0 只引入 `S3Uri` / `BlobLocation` 这类 URI 解析值对象；
  `BlobStore` 名称保留到未来真正需要对象存储 I/O 时再引入。

### D16. 详情 URI 返回方式

- **选项 A**：默认返回原始 `s3://...` URI 与元信息，不返回 presigned URL。
- **选项 B**：默认返回 presigned URL。

### D17. 缺失 blob 的接口行为

- **选项 A**：blob 不存在时直接过滤该记录；单对象接口过滤后无结果则返回 `404`，历史接口返回过滤后的 `items`。
- **选项 B**：返回对象级缺失标记，不因单个缺失导致整批失败。
- **选项 C**：blob 对象存在性不由运行时探测，作为服务外部数据装载前置条件保证。

### D18. 名称匹配 / Entity Linking 内核的 MVP 规则

- **选项 A**：只做规范化 + 完全/前缀匹配，不引入编辑距离模糊。
- **选项 B**：MVP 即引入编辑距离或更复杂模糊匹配。

### D19. `facts` 批量接口返回范围

- **选项 A**：只返回 basic facts。
- **选项 B**：默认返回 basic facts + 固定内置 detail 元信息。
- **选项 C**：默认返回 basic facts；仅在请求中显式传入 `profileEntryCodes[]` 时追加指定
  non-basic detail 元信息。

### D20. 历史接口分页协议

- **选项 A**：使用 `page` + `size`。
- **选项 B**：使用 `cursor` + `limit`。
- **选项 C**：MVP 不分页，直接全量返回。

### D21. `entity_basic_profile` 时态正确性的责任归属

- **选项 A**：由 `koduck-knowledge` 在 DB 或应用层负责治理与校验。
- **选项 B**：由服务外部数据契约保证；`koduck-knowledge` 只消费并返回既有数据。

### D22. `canonical_name` 与 `entity_name` 的语义

- **选项 A**：`canonical_name` 为稳定规范名；`entity_name` 为时态展示名，允许不同。
- **选项 B**：两者必须始终相同。
- **选项 C**：移除 `entity_name`，统一只保留 `canonical_name`。

### D23. `search` 接口的 `domainClass`

- **选项 A**：必填。
- **选项 B**：选填，不传时跨 domain 搜索。
- **选项 C**：`search` 必填，`link` 选填。

### D24. 详情路径中的 `entry_code` 规则

- **选项 A**：固定使用大写字典 code；未知值返回 `404`，`BASIC` 调用 detail/history
  路径返回 `400`。
- **选项 B**：大小写不敏感，服务内部归一化。
- **选项 C**：路径中只接受字典 ID。

### D25. 可选 `at` 参数的默认语义

- **选项 A**：未传 `at` 时统一使用请求处理时刻的 `now()`。
- **选项 B**：未传 `at` 时仅命中开放段/当前版本。
- **选项 C**：不同接口使用不同默认值。

### D26. `facts` 扁平数组展开规则

- **选项 A**：逐事实一行；每个实体始终返回 1 条 basic fact，如请求了
  `profileEntryCodes[]`，则每个命中的 non-basic entry 再各返回 1 条 detail fact。
- **选项 B**：仅在请求 detail 时返回 detail 行，不重复 basic 行。
- **选项 C**：使用显式 `factType` 的混合 view 模型。

### D27. 资源不存在或当前时态无命中的返回语义

- **选项 A**：单对象读取接口返回 `404`；历史接口返回 `200 + items=[]`。
- **选项 B**：单对象读取接口返回 `200 + null/empty object`；历史接口返回 `200 + items=[]`。
- **选项 C**：按“实体不存在”和“时态无命中”区分返回语义。

### D28. history 分页默认值与边界

- **选项 A**：`page` 从 `1` 开始，默认 `page=1,size=20`，`size<=100`，非法值返回 `400`。
- **选项 B**：`page` 从 `0` 开始，默认 `page=0,size=20`，`size<=100`，非法值返回 `400`。
- **选项 C**：必须显式传 `page,size`，非法值返回 `400`。

### D29. `facts.domainClass` 是否必填

- **选项 A**：必填。
- **选项 B**：选填，不传时跨 domain 返回。
- **选项 C**：选填，但多 domain 命中时返回 `400`。

### D30. 对外名称查询接口形态

- **选项 A**：只提供 `search` 一个对外接口；命中 `entity_id` 后继续读取满足条件的 `basic_profile`，任一条件不满足返回空结果。
- **选项 B**：同时提供独立 `link` 与 `search` 两个接口。

### D31. 公共响应 DTO 复用策略

- **选项 A**：不复用 `koduck-common` 的 `ApiResponse`、`PageResponse` 等公共 DTO，`koduck-knowledge` 自定义响应模型。
- **选项 B**：仅复用 `ApiResponse`，分页结构自定义。
- **选项 C**：同时复用 `ApiResponse` 与 `PageResponse`。

### D32. `search` 中同一 `entity_id` 多命中路径的返回方式

- **选项 A**：按 `entity_id` 去重，只保留最高优先级命中。
- **选项 B**：允许同一 `entity_id` 因不同命中路径重复返回多条 `SearchHit`。
- **选项 C**：视为数据异常并报错。

### D33. history 分页 `total` 的定义

- **选项 A**：`total` 表示分页过滤后、实际可返回记录总数。
- **选项 B**：`total` 表示原始 DB 命中总数。
- **选项 C**：不返回 `total`。

### D34. Phase 0 的 APISIX 验收口径

- **选项 A**：只验路由已注册且配置正确，不要求 northbound 业务转发链路完成。
- **选项 B**：要求合法 JWT 请求已能正常转发到业务接口。
- **选项 C**：只要求能转发到健康检查端点。

### D35. 未知 `domainClass` 的返回语义

- **选项 A**：所有出现 `domainClass` 的接口都先按 `domain_dict` 校验；缺失或未知值统一返回 `400`。
- **选项 B**：`search/facts` 返回空结果，detail/history 返回 `404`。
- **选项 C**：统一返回 `404`。

### D36. `domain_dict` / `profile_entry_dict` 的内部解析责任

- **选项 A**：controller 接收字符串；service 先查字典并解析为内部 ID，再调用 repository。
- **选项 B**：repository 直接 join 字典表，对外继续按 code/class 查询。
- **选项 C**：同时保留按 code/class 与按 ID 的两套查询接口。

### D37. 错误响应模型

- **选项 A**：最小模型 `{ code, message }`。
- **选项 B**：统一最小模型 `{ code, message, details? }`。
- **选项 C**：不单独定格式，沿用 Spring 默认错误响应。

---

## 决策结果

### 选定的方案

| 决策 | 选定选项 |
| --- | --- |
| D1 技术栈 | **A：Java (Spring Boot) + 独立 Postgres** |
| D2 Blob 存储 | **B：统一采用 S3 协议对象存储；本地可选 MinIO 样例** |
| D3 两表关系 | **B：保留两表，basic 只落 `entity_basic_profile`** |
| D4 历史模型 | **A：`profile_id` + `version` + `is_current`** |
| D5 多段历史 | **B：允许多段历史** |
| D6 耦合边界 | **B：独立顶层项目，仅共享公共 Maven 依赖** |
| D7 日志方案 | **B：slf4j + log4j2 + JSON 格式** |
| D8 构建与部署形态 | **B：GraalVM Native Image 作为默认发布形态** |
| D9 k8s 接入 | **B：纳入仓库 `k8s/deploy.sh` 与 `k8s/uninstall.sh`** |
| D10 API 文档 | **B：集成 springdoc-openapi / Swagger UI** |
| D11 构建方式 | **B：统一在 Docker 容器内构建** |
| D12 运行时写入职责 | **B：当前只提供读查询接口** |
| D13 跨表外键策略 | **B：所有跨表引用均为逻辑引用，不建立物理 FK** |
| D14 服务外部数据契约范围 | **A：只定义服务消费契约，不定义离线构建流程** |
| D15 BlobStore 运行时职责 | **C：Phase 0 只引入 `S3Uri` / `BlobLocation`，`BlobStore` 留待未来 I/O 能力再引入** |
| D16 详情 URI 返回方式 | **A：默认返回原始 `s3://...` URI** |
| D17 缺失 blob 的接口行为 | **C：blob 存在性由服务外部装载前置条件保证** |
| D18 名称匹配 / Entity Linking 内核规则 | **A：仅规范化 + 完全/前缀匹配** |
| D19 `facts` 批量接口返回范围 | **C：默认 basic，显式 `profileEntryCodes[]` 才追加指定 detail 元信息** |
| D20 历史接口分页协议 | **A：使用 `page` + `size`** |
| D21 `entity_basic_profile` 时态正确性归属 | **B：由服务外部数据契约保证，服务只读返回** |
| D22 名称语义 | **A：`canonical_name` 稳定规范名，`entity_name` 时态展示名** |
| D23 `search.domainClass` | **A：必填** |
| D24 `entry_code` 路径规则 | **A：大写 code；未知值 `404`，`BASIC` 走 detail/history 返回 `400`** |
| D25 可选 `at` 参数默认语义 | **A：未传时统一使用 `now()`** |
| D26 `facts` 扁平数组展开规则 | **A：逐事实一行，basic 固定返回，detail 按 entry 追加** |
| D27 无命中返回语义 | **A：单对象读取 `404`；历史接口 `200 + items=[]`** |
| D28 history 分页默认值与边界 | **A：`page=1,size=20,size<=100`，非法值 `400`** |
| D29 `facts.domainClass` 是否必填 | **A：必填** |
| D30 对外名称查询接口形态 | **A：只提供 `search` 一个对外接口** |
| D31 公共响应 DTO 复用策略 | **A：不复用 `koduck-common` 公共 DTO** |
| D32 `search` 中同一 `entity_id` 多命中路径的返回方式 | **B：允许重复返回多条 `SearchHit`** |
| D33 history 分页 `total` 的定义 | **A：返回过滤后总数** |
| D34 Phase 0 的 APISIX 验收口径 | **A：只验路由注册与配置正确** |
| D35 未知 `domainClass` 的返回语义 | **A：缺失或未知值统一返回 `400`** |
| D36 `domain_dict` / `profile_entry_dict` 的内部解析责任 | **A：service 先做字典校验与解析，再调 repository** |
| D37 错误响应模型 | **B：统一 `{ code, message, details? }`** |

### 理由

1. Java 与仓库主栈一致，团队熟悉，适合当前查询型服务。
2. 统一 S3 协议对象路径规范，保证本地样例与生产环境的消费契约一致。
3. `entity_basic_profile` 作为召回主入口，`entity_profile` 作为详情分片，职责清晰。
4. `entity_profile` 使用版本化主键，方便历史读取与回放，不要求覆盖旧值。
5. `entity_basic_profile` 允许多段历史，更贴合真实时序变化。
6. 独立项目可以避免把知识服务耦合进 `koduck-backend` 生命周期。
7. log4j2 + JSON 便于与仓库现有结构化日志口径对齐。
8. GraalVM Native Image 适合轻计算、读取型服务的启动性能目标。
9. 统一接入仓库 k8s 脚本，减少服务私有部署口径。
10. springdoc-openapi 能让查询接口契约直接从代码导出。
11. Docker 统一构建能锁定工具链，避免环境漂移。
12. 当前把写入链路排除在外，可以显著降低 MVP 范围与实现复杂度。
13. 逻辑引用保留未来拆分、归档与离线装载灵活性。
14. 同名异人场景必须保留多候选，避免在查询链路中过早裁剪。
15. 事实构建与导入由外部承担，`koduck-knowledge` 只面向已有数据提供读取能力。
16. 由于仓库现有 dev/prod APISIX 已存在 `/api/* -> backend` 通配路由，knowledge 必须注册
  显式 `/api/v1/entities/*` 路由并使用更高优先级，避免 northbound 流量误入 backend。
17. 仓库现有受保护业务路由标准为 `jwt-auth + proxy-rewrite(headers.set)`，统一注入
  `X-User-Id`、`X-Username`、`X-Roles`、`X-Tenant-Id`，knowledge 应沿用这一标准。
18. 当前先锁定表结构、字典、blob JSON 最小结构、对象路径与示例数据集，不在 ADR 中展开离线构建编排。
19. 当前 MVP 只需要 `s3://...` URI 的解析与封装，因此 Phase 0 先落
   `S3Uri` / `BlobLocation` 值对象即可；`BlobStore` 名称保留给未来真正需要对象存储
   I/O 时再引入，避免把当前任务做重。
20. 详情相关接口默认返回 raw URI，避免把对象分发能力混入查询服务。
21. blob 对象存在性不由 `koduck-knowledge` 运行时探测，而是作为服务外部数据装载前置条件保证，避免在查询路径引入额外对象存储探测成本。
22. 名称匹配 / Entity Linking 内核固定为规范化、完全匹配与前缀匹配，不引入编辑距离模糊，保证结果稳定可复现。
23. Native Image 不是后置优化项，而是 Phase 0 起即需满足的默认发布形态基线。
24. `facts` 批量接口默认只返回 basic facts；只有调用方显式传入
   `profileEntryCodes[]` 时，才追加指定 non-basic detail 元信息。
25. 历史接口统一采用 `page` + `size`，响应 envelope 固定为
   `{ items, page, size, total }`，避免 Phase 2 再次发散。
26. `entity_basic_profile` 的开放段唯一、时间段不重叠等时态正确性属于服务外部数据契约；
   `koduck-knowledge` 不负责治理、修复或裁剪异常重叠段。
27. `canonical_name` 用于稳定实体标识与名称匹配结果返回，`entity_name` 用于返回时态展示名。
28. `search` 接口要求显式传入 `domainClass`，保持当前 MVP 的知识域边界稳定。
29. 详情与历史详情路径中的 `entry_code` 固定使用大写字典 code；未知值返回 `404`，
   `BASIC` 调用 detail/history 路径返回 `400`。
30. 所有带可选 `at` 的查询接口在未传 `at` 时统一按请求处理时刻的 `now()` 执行，
   避免不同接口各自推断默认时态。
31. `facts` 批量接口的 `domainClass` 为必填，避免一个 `entity_id` 在多个知识域下出现歧义。
32. 对外只提供一个 `search` 名称查询接口，不再暴露独立 `link` 接口；`search` 只有在
   “名称匹配 + basic_profile 命中”同时满足时才返回结果。
33. `search` 采用“按命中路径逐条返回”，若同一 `entity_id` 同时命中多条名称路径，
   则允许重复返回多条 `SearchHit`，不在服务内按实体去重。
34. `facts` 批量接口采用“按实体全满足才返回”的展开：实体必须先命中当前
   `domainClass + at` 下有效的 basic fact；若请求了 `profileEntryCodes[]`，
   则这些 non-basic entry 也必须全部存在，满足后才返回该实体的 1 条 basic fact
   与各条 detail fact。
35. 单对象读取接口在资源不存在或当前时态无命中时统一返回 `404`；历史接口在无命中时
   返回 `200 + items=[]`。
36. history 分页中的 `total` 固定表示过滤后、实际可返回给调用方的记录总数。
37. HTTP 响应模型由 `koduck-knowledge` 自定义，不复用 `koduck-common` 的
   `ApiResponse` 或 `PageResponse`。
38. history 分页统一采用 `page` 从 `1` 开始、默认 `page=1,size=20`、`size<=100`，
   非法分页参数返回 `400`。
39. Phase 0 的 APISIX 验收只要求 knowledge 路由已注册且配置正确；真正 northbound
   业务转发验证留到 Phase 2/3。
40. 所有出现 `domainClass` 的接口都必须先按 `domain_dict` 校验，缺失或未知值统一
   返回 `400`，避免把“非法入参”和“无数据命中”混为一谈。
41. `domain_dict` 与 `profile_entry_dict` 的解析责任固定在 service 层：controller
   接收字符串入参，service 完成字典校验、`code/class -> id` 解析与错误映射，
   repository 保持面向内部键值的只读查询职责。
42. 既然不复用 `koduck-common` 响应模型，则错误响应也必须显式定稿；当前统一采用
   `{ code, message, details? }`，其中 `details` 仅在参数校验失败等需要补充上下文时返回。

### 积极后果

- 服务职责更单一，MVP 范围更可控。
- 数据模型与查询接口可以优先稳定下来。
- 不需要在当前阶段设计候选区、审核流、发布流。
- 同名异人场景可直接通过多候选返回支持外部判定。
- 本地与生产对象存储协议一致，便于回归测试。

### 消极后果

- 数据新鲜度依赖外部装载流程，而非服务内闭环。
- 需要额外准备最小字典种子、blob JSON 与联调样例数据。
- 无物理 FK 时，脏数据不会被 DB 自动完全拦截。
- 只读服务无法直接承接人工修正，需要外部流程配合。

### 缓解措施

- 用文档明确写清楚“服务外部负责装载”的边界。
- 先把消费契约定稿为文档附件或实现计划中的固定章节，避免边做边猜。
- 通过 Testcontainers 构建稳定的只读查询测试夹具。
- 通过应用层查询容错与集成测试覆盖别名冲突、缺失分片、时态空洞等场景。
- 保留 schema 的演进空间，未来若要新增写入服务，单独 ADR 立项。
- 通过只读 API 契约与日志指标，先把读取链路打磨稳定。

---

## 实施细节

### 总体架构

- 服务：`koduck-knowledge`（Spring Boot 3.x，独立顶层项目）
- 存储：独立 PostgreSQL 库 `koduck_knowledge` + S3 协议对象存储（本地可选 MinIO 样例）
- API：REST + OpenAPI 3.x / Swagger UI
- 网关：通过现有 APISIX `apisix-route-init` Job 暴露 `/api/v1/entities/*` 显式路由，复用
  `jwt-auth + proxy-rewrite(headers.set)` 的受保护 API 基线
- 日志：slf4j + log4j2 + JSON 格式
- 构建：Docker 内统一构建，Native Image 默认发布
- 边界：运行时仅提供读取接口，不提供写入、审核、发布接口

### 服务外部消费契约（Phase 0 定稿）

- 当前 ADR 仅锁定服务消费契约，不定义离线构建、调度或人工修数流程。
- 必须同时定稿以下内容：
  - `domain_dict` 与 `profile_entry_dict` 的 MVP 最小种子；
  - `basic_profile` 与 `entity_profile` 的 blob JSON 最小结构；
  - 区分 `basic_profile` 与 `entity_profile` 的对象路径规范；
  - 用于集成测试与联调的最小示例数据集。

### 数据模型（Phase 1 定稿）

#### `entity`

```sql
entity_id       BIGSERIAL PRIMARY KEY
canonical_name  TEXT NOT NULL
type            TEXT NOT NULL
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (canonical_name, type)
```

#### `entity_alias`

```sql
alias_id   BIGSERIAL PRIMARY KEY
entity_id  BIGINT NOT NULL
alias      TEXT NOT NULL
lang       TEXT NOT NULL
source     TEXT NOT NULL
UNIQUE (entity_id, alias, lang)
```

> 同一 `alias + lang` 可以映射多个 entity，用于保留同名异人场景。

#### `domain_dict`

```sql
domain_class  TEXT PRIMARY KEY
display_name  TEXT NOT NULL
description   TEXT
```

语义约束：

- `domain_class` 表示知识域，不表示实体类型。
- 当前 MVP 中 `entity.type` 与 `domain_class` 显式区分：
  - `entity.type`：`person`
  - `domain_class`：`finance`

MVP 最小种子固定为：

- `finance`

#### `profile_entry_dict`

```sql
profile_entry_id  INT PRIMARY KEY
code              TEXT UNIQUE NOT NULL
is_basic          BOOLEAN NOT NULL DEFAULT false
```

MVP 最小种子固定为：

- `BASIC`（`is_basic=true`）
- `BIO`（`is_basic=false`）
- `HONOR`（`is_basic=false`）

#### `entity_basic_profile`

```sql
entity_id               BIGINT NOT NULL
domain_class            TEXT NOT NULL
entity_name             TEXT NOT NULL
valid_from              TIMESTAMPTZ NOT NULL
valid_to                TIMESTAMPTZ
basic_profile_entry_id  INT NOT NULL
basic_profile_s3_uri    TEXT NOT NULL
PRIMARY KEY (entity_id, domain_class, valid_from)
CHECK (valid_to IS NULL OR valid_to > valid_from)
```

业务约束：

- `basic_profile_entry_id` 必须对应 `is_basic = true`，该规则由应用层与装载流程保证，不通过物理 FK 强制。
- `entity_basic_profile` 的开放段唯一、时间段不重叠等时态正确性由服务外部数据契约保证，
  `koduck-knowledge` 运行时不负责治理或修复。
- 当前服务消费契约假设同一 `(entity_id, domain_class, at)` 至多命中一段有效记录。

#### `entity_profile`

```sql
profile_id        BIGSERIAL PRIMARY KEY
entity_id         BIGINT NOT NULL
profile_entry_id  INT NOT NULL
blob_uri          TEXT NOT NULL
version           INT NOT NULL
is_current        BOOLEAN NOT NULL
loaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (entity_id, profile_entry_id, version)
```

业务约束：

- 同一 `(entity_id, profile_entry_id)` 仅允许一条 `is_current = true`。
- 禁止 `is_basic = true` 的 entry 写入 `entity_profile`，该规则由应用层与装载流程保证，不通过物理 FK 强制。

### Blob JSON 最小结构

`basic_profile` 对应对象最小结构：

```json
{
  "schemaVersion": 1,
  "entityId": 123,
  "domainClass": "finance",
  "entryCode": "BASIC"
}
```

约束：

- `basic_profile` 仅保留定位与识别所需元信息，不承载 `summary` 或其他详情摘要内容。

`entity_profile` 对应对象最小结构：

```json
{
  "schemaVersion": 1,
  "entityId": 123,
  "entryCode": "BIO",
  "version": 1,
  "content": {}
}
```

### 对象路径规范

- `basic_profile`：
  `s3://<bucket>/<prefix>/<entity_id>/<entry_code>/<valid_from>.json`
- `entity_profile`：
  `s3://<bucket>/<prefix>/<entity_id>/<entry_code>/<version>.json`

其中 `basic_profile` 的 `valid_from` 固定编码为 UTC ISO 基础格式：

- `yyyyMMdd'T'HHmmss'Z'`
- 例如：`20260417T120000Z`

### 最小示例数据集

用于集成测试与联调的基线样例固定至少包含：

- 单实体 `canonical` 完全命中；
- 同名异人多候选命中；
- `entity_basic_profile` 多段历史（含 open / closed segment）；
- `entity_profile` 多版本历史；
- 外部数据契约保证 blob 可用的样例。

### 名称匹配 / Entity Linking 内核规则

- 先做 `trim`、大小写折叠与全半角统一。
- 候选来源仅限 `entity.canonical_name` 与 `entity_alias.alias`。
- 排序固定为：`canonical` 完全匹配 > `alias` 完全匹配 >
  `canonical` 前缀匹配 > `alias` 前缀匹配。
- MVP 不引入编辑距离、拼音近似或向量召回。
- `matchType` 固定采用以下枚举：
  - `CANONICAL_EXACT`
  - `ALIAS_EXACT`
  - `CANONICAL_PREFIX`
  - `ALIAS_PREFIX`
- 同分候选按 `entity_id` 升序稳定返回。

### 查询接口范围

- `GET /api/v1/entities/actions/search`
- `POST /api/v1/entities/actions/facts`
- `GET /api/v1/entities/{id}/basic-profile`
- `GET /api/v1/entities/{id}/profiles/{entry_code}`
- `GET /api/v1/entities/{id}/basic-profile/history`
- `GET /api/v1/entities/{id}/profiles/{entry_code}/history`

命名约束：

- 对外 API 中单值知识域参数统一命名为 `domainClass`。
- `GET /api/v1/entities/actions/search` 的 `domainClass` 为必填参数。
- `canonicalName` 表示稳定规范名；`entityName` 表示 basic profile 的时态展示名。

接口返回约束：

- `facts/detail/history` 相关接口默认返回 raw `s3://...` URI 与元信息，不返回 presigned URL。
- 当前 MVP 仅提供 `S3Uri` / `BlobLocation` 这类 URI 解析值对象；`BlobStore` 名称保留给未来真正需要对象存储 I/O 时再引入。
- `POST /api/v1/entities/actions/facts` 响应保持扁平数组 `EntityFactView[]`。
- `POST /api/v1/entities/actions/facts` 请求体固定为
  `{ entityIds, domainClass, at?, profileEntryCodes? }`；`domainClass` 为必填；
  未传 `profileEntryCodes` 时只返回 basic facts，传入时仅追加指定 non-basic
  detail 元信息。
- 所有出现 `domainClass` 的接口都必须先按 `domain_dict` 校验；缺失或未知值统一返回 `400`。
- 所有带可选 `at` 的查询接口在未传 `at` 时，统一使用 `now()` 作为查询时态点。
- `GET /api/v1/entities/actions/search` 只在“名称匹配 + basic_profile 命中”
  同时满足时返回结果，任一条件不满足则返回空数组。
- `GET /api/v1/entities/actions/search` 按命中路径逐条返回结果；
  若同一 `entity_id` 同时命中多条匹配路径，则允许返回多条 `SearchHit`。
- `POST /api/v1/entities/actions/facts` 采用“按实体全满足才返回”的展开：
  每个实体必须先命中当前 `domainClass + at` 下有效的 basic fact；
  若请求了 `profileEntryCodes[]`，则这些 non-basic entry 也必须全部命中；
  满足后才返回该实体的 1 条 basic fact 与各条 detail fact。
- 历史接口统一使用 `page` + `size` 分页，并返回 `{ items, page, size, total }`。
- history 的 `total` 表示过滤后、实际可返回记录总数。
- history 分页规则固定为：`page` 从 `1` 开始，默认 `page=1,size=20`，`size`
  最大 `100`，非法值返回 `400`。
- 单对象读取接口在资源不存在或当前时态无命中时返回 `404`；历史接口在无命中时返回
  `200 + items=[]`。
- `profiles/{entry_code}` 及其 history 路径中的 `entry_code` 固定使用大写字典 code；
  未知 `entry_code` 返回 `404`，使用 `BASIC` 调用 detail/history 路径返回 `400`。
- controller 接收 `domainClass`、`entry_code`、`profileEntryCodes[]` 字符串入参；
  service 负责查 `domain_dict` 与 `profile_entry_dict`，完成校验、`code/class -> id`
  解析与错误映射后，再调用 repository。
- blob 对象存在性不由运行时探测，作为服务外部数据装载前置条件保证。
- 所有 `4xx` 错误响应统一使用 `{ code, message, details? }`。

### APISIX 暴露要求

- dev/prod 的 `apisix-route-init` Job 需要新增 `knowledge-service` 路由。
- 路由 `uri` 固化为 `/api/v1/entities/*`，优先级高于现有 `/api/* -> backend` 通配路由。
- upstream 指向 `koduck-knowledge` Service。
- 路由插件对齐现有受保护 API 标准：`jwt-auth + proxy-rewrite(headers.set)`。
- `proxy-rewrite` 统一注入 `X-User-Id=$jwt_claim_sub`、
  `X-Username=$jwt_claim_username`、`X-Roles=$jwt_claim_roles`、
  `X-Tenant-Id=$jwt_claim_tenant_id`。
- `koduck-knowledge` 以下游服务身份消费这些头信息为主，不新增服务内 JWT 验签主路径。

### 不在当前范围内的接口

- 候选写入接口
- 判定结果回写接口
- 人工审核接口
- 发布接口
- 任何运行时插入、更新、删除接口

### 实施计划

- [ ] Phase 0：创建 `koduck-knowledge` 模块骨架、`S3Uri` / `BlobLocation` 解析层、Testcontainers、日志与构建链路。
- [ ] Phase 1：落地只读事实模型与名称匹配最小内核。
- [ ] Phase 2：实现 `search/facts/detail/history` 查询接口。
- [ ] Phase 3：完成指标、压测、部署验证。
- [ ] Phase 4（预留）：未来若需要写入链路或事实构建链，单独 ADR 立项。

---

## 相关文档

- [docs/design/entity-knowledge-base-design.md](../design/entity-knowledge-base-design.md)
- [docs/adr/0000-template.md](../adr/0000-template.md)

---

## 备注

- MVP 阶段不引入向量库。
- 事实构建与导入不属于当前服务运行时范围。
- 若未来需要运行时写入链路，应新建独立 ADR，不直接恢复旧治理链描述。

---

## 变更日志

| 日期 | 变更 | 作者 |
| ------ | ------ | ------ |
| 2026-04-17 | 初始版本，锁定 MVP 架构与数据模型 | @guhailin |
| 2026-04-17 | 补充独立项目边界、log4j2 JSON、GraalVM Native Image、k8s 脚本接入 | @guhailin |
| 2026-04-17 | 收口到只读事实查询服务：移除运行时治理链与写入职责，明确数据装载在服务外部完成 | @guhailin |
| 2026-04-17 | 补充 APISIX northbound 注册要求，并对齐现有鉴权基线 | @guhailin |
| 2026-04-17 | 定稿消费契约、blob 最小结构、raw URI 返回、应用层跨表校验与 Entity Linking MVP 规则 | @guhailin |
| 2026-04-17 | 补充未知 `domainClass` 统一 `400`、service 层字典解析、`BlobStore` 仅 URI 解析职责与 `ErrorResponse` 契约 | @guhailin |
| 2026-04-17 | 调整 Phase 0 为 `S3Uri` / `BlobLocation` URI 解析层，并将 `BlobStore` 名称预留到未来对象存储 I/O 能力 | @guhailin |
| 2026-04-17 | 移除 search `confidence`、删除 repository `find...Now`、将 MinIO 降为可选样例能力，并将 `DictionaryResolver` 新增异常验收收口为成功/失败 | @guhailin |
