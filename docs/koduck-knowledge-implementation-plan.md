# Koduck Knowledge 实施任务清单

> 本文档基于 `docs/design/entity-knowledge-base-design.md` 与
> `docs/implementation/adr-0001-koduck-knowledge-mvp-architecture.md` 拆分，
> 提供 step-by-step 可执行任务。
>
> **状态**: 已完成（Phase 0 - Phase 3 已完成）
> **创建日期**: 2026-04-17
> **负责人**: @guhailin
> **对应设计文档**: [entity-knowledge-base-design.md](design/entity-knowledge-base-design.md)
> **对应 ADR**: [adr-0001-koduck-knowledge-mvp-architecture.md](implementation/adr-0001-koduck-knowledge-mvp-architecture.md)

## 范围与目标

### MVP 目标

跑通“人 × domain 关联”的只读事实查询闭环：

1. 名称匹配与实体标准化查询。
2. 候选召回与基础事实返回。
3. 详情分片、历史版本与批量事实读取。

### 非目标（MVP 不做）

- 任何运行时插入、更新、删除接口。
- “候选 → 判定 → 审核 → 发布”治理链。
- 服务内事实构建、清洗、审核、导入。
- `fact_store` 事实层。
- 动态关系推理。
- 向量检索。

## 与相关项目的职责边界

`koduck-knowledge` 是独立顶层项目，**不依赖 `koduck-backend` 任何运行时组件**；
仅允许复用版本管理能力（如 `koduck-bom`），不复用 `koduck-common` 的 DTO、异常封装或分页模型。

| 主题 | 落点 | 当前要求 |
| ------ | ------ | ---------- |
| 与 `koduck-backend` 的关系 | 全阶段 | 独立项目，只共享版本管理能力；禁止引用其运行时代码与 `koduck-common` 公共模型 |
| 服务职责 | 全阶段 | 当前 MVP 仅提供只读查询接口，不承担运行时写入 |
| 数据构建与装载 | 服务外部 | 由离线流程、数据构建服务或运维脚本负责，不在 `koduck-knowledge` 内实现 |
| 名称匹配 | Phase 1 / Phase 2 | 由 `koduck-knowledge` 提供名称匹配与 `basic_profile` 命中后的 search 能力 |
| 对象存储 | Phase 0 / Phase 1 | 默认 S3 协议；如需本地对象路径样例，可选接 `koduck-dev` MinIO；禁止直连文件系统 |
| 日志方案 | Phase 0 全阶段 | slf4j + log4j2 + JSON 格式；Spring Boot 默认 logback 必须排除 |
| API 文档 | Phase 0 全阶段 | 集成 `springdoc-openapi-starter-webmvc-ui`，代码即契约 |
| 构建形态 | Phase 0 / Phase 3 | 统一在 Docker 容器内构建；禁止本地裸机构建发布产物 |
| 构建与部署 | Phase 0 / Phase 3 | GraalVM Native Image 作为默认发布形态，Phase 0 即纳入强验收；保留 `jvm` profile |
| APISIX 注册 | Phase 0 / Phase 2 | 注册 knowledge 显式路由并对齐 `jwt-auth` 基线 |
| k8s 接入 | Phase 0 | 纳入仓库 `k8s` 目录与统一 `deploy/uninstall` 脚本 |
| 网关 / 鉴权 | Phase 2 | 对齐 `jwt-auth + proxy-rewrite` 与四个身份头透传 |

> 当前 MVP 的前提是：数据库与对象存储中的事实已经由服务外部准备完成。
> `koduck-knowledge` 运行时只负责查询、组装与返回。
> 当前阶段只锁定服务消费契约，不展开离线构建编排。

---

## 执行阶段概览

| 阶段 | 名称 | 依赖 | 优先级 |
| ------ | ------ | ------ | -------- |
| Phase 0 | 项目骨架与基础设施 | ADR-0001 | P0 |
| Phase 1 | 只读数据模型与名称匹配内核 | Phase 0 | P0 |
| Phase 2 | 查询接口（search/facts/detail/history） | Phase 1 | P0 |
| Phase 3 | 观测、压测与部署验证 | Phase 2 | P1 |
| Phase 4（预留） | 写入链路或事实构建能力 | 不纳入 MVP | P2 |

---

## Phase 0：项目骨架与基础设施

### Task 0.1：创建 `feature/knowledge-bootstrap` worktree

**执行命令：**

```bash
git checkout dev && git pull origin dev
git worktree add ../worktree-knowledge-bootstrap -b feature/knowledge-bootstrap
```

**验收标准：**

- [x] worktree 创建成功，分支从最新 `dev` 派生。
- [x] `git branch --show-current` 返回 `feature/knowledge-bootstrap`。
- [x] Phase 0 默认在该 worktree 内连续推进，并汇总为一个 Phase 0 PR。

---

### Task 0.2：新建 Maven 模块 `koduck-knowledge`

**文件：** `koduck-knowledge/pom.xml`

**详细要求：**

1. 独立顶层项目，与 `koduck-backend` 并列。
2. 包结构：
   `com.koduck.knowledge.{app,api,service,repository,entity,dto,blob,config,exception}`。
3. 引入 Spring Boot 3.x、Spring Data JPA、Flyway、Testcontainers、
   `springdoc-openapi-starter-webmvc-ui`。
4. 排除 `spring-boot-starter-logging`，启用 `spring-boot-starter-log4j2`。
5. 启用 GraalVM Native Image 所需 Maven 插件与 profile。

**验收标准：**

- [x] Docker 构建能完成 `mvn compile`。
- [x] 依赖树中不含 `koduck-backend` 与 `logback-classic`。
- [x] 包结构符合仓库 Java 规范。

---

### Task 0.3：Spring Boot 启动骨架

**文件：**

- `koduck-knowledge/src/main/java/com/koduck/knowledge/KoduckKnowledgeApplication.java`
- `koduck-knowledge/src/main/resources/application.yml`

**详细要求：**

1. 启用 JPA、事务、Actuator。
2. 暴露 `/actuator/health`、`/actuator/info`、`/actuator/prometheus`。
3. 集成 `springdoc-openapi-starter-webmvc-ui`。
4. 提供 `OpenApiConfig`，统一注入 API info 与 server URL。
5. 启动日志输出版本、环境、监听端口。

**验收标准：**

- [x] 镜像启动后能响应健康检查。
- [x] Swagger UI 可访问。
- [x] 能导出 `openapi.yaml`。

---

### API 契约规范（跨任务贯彻）

1. 所有业务端点统一使用 `/api/v1/...` 前缀。
2. 字面量路由段必须先于 `/{id}` 注册。
3. Controller 使用 `@Operation` / `@Parameter`，DTO 使用 `@Schema`。
4. 统一 DTO：
   - `SearchHit`：
     `{ entityName, basicProfileS3Uri, validFrom, validTo }`
     并固定包含
     `{ entityId, canonicalName, matchType }`
     其中 `matchType` 固定枚举为
     `CANONICAL_EXACT | ALIAS_EXACT | CANONICAL_PREFIX | ALIAS_PREFIX`
   - `EntityFactView`：
     `{ entityId, domainClass, entityName, basicProfileS3Uri, validFrom, validTo,
     profileEntryCode?, blobUri? }`
5. 名称匹配逻辑只作为 `search` 的内部步骤存在，不单独对外暴露 `link` 接口。
6. 同名异人允许返回多个结果；若同一 `entityId` 因不同命中路径重复命中，也允许重复返回多条 `SearchHit`。
7. 当前 MVP 不暴露任何 Create / Update / Delete 业务接口。
8. HTTP 响应与分页 DTO 由 `koduck-knowledge` 自定义，不复用 `koduck-common`。
9. 对外暴露必须通过 APISIX 显式注册 `/api/v1/entities/*`，不得依赖现有 `/api/*`
   通配路由兜底到 `backend`。
10. knowledge 路由鉴权方式对齐现有受保护 API：启用 `jwt-auth`，并通过 `proxy-rewrite`
   注入 `X-User-Id`、`X-Username`、`X-Roles`、`X-Tenant-Id`；服务侧以网关注入身份头为主，
   不自行解析外部 JWT 作为主路径。
11. `facts/detail/history` 默认返回 raw `s3://...` URI 与元信息，不默认返回 presigned URL。
12. `POST /api/v1/entities/actions/facts` 响应保持扁平数组 `EntityFactView[]`，不按
    `entityId` 分组。
13. blob 对象存在性不由 `koduck-knowledge` 运行时探测，默认作为服务外部数据装载前置条件保证。
14. 当前 MVP 仅提供 `S3Uri` / `BlobLocation` 这类值对象，用于 `s3://...` URI 的解析、
    封装与协议边界收口；`BlobStore` 名称保留给未来真正需要对象存储 I/O 时再引入。
15. 当前 MVP 查询链路不直接访问对象存储。
16. 对外 API 中单值知识域参数统一命名为 `domainClass`。
17. `canonicalName` 表示稳定规范名；`entityName` 表示 basic profile 的时态展示名，允许不同。
18. `GET /api/v1/entities/actions/search` 的 `domainClass` 为必填参数。
19. 所有出现 `domainClass` 的接口都必须先按 `domain_dict` 校验；缺失或未知值统一返回 `400`。
20. `POST /api/v1/entities/actions/facts` 请求体固定为
    `{ entityIds, domainClass, at?, profileEntryCodes? }`；`domainClass` 为必填；
    未传 `profileEntryCodes` 时只返回 basic facts，传入时仅追加指定 non-basic
    detail 元信息。
21. `profileEntryCodes[]` 只接受大写 non-basic `code`；未知值或传入 `BASIC`
    返回 `400`。
22. 历史接口统一使用 `page` + `size` 分页，并返回 `{ items, page, size, total }`。
23. `profiles/{entry_code}` 及其 history 路径中的 `entry_code` 固定使用大写字典 code；
    未知 `entry_code` 返回 `404`，使用 `BASIC` 调用 detail/history 路径返回 `400`。
24. 所有带可选 `at` 的查询接口在未传 `at` 时，统一使用请求处理时刻的 `now()`。
25. `POST /api/v1/entities/actions/facts` 采用“按实体全满足才返回”的规则：
    每个实体必须先命中当前 `domainClass + at` 下有效的 basic fact；
    若请求了 `profileEntryCodes[]`，则这些 non-basic entry 也必须全部命中；
    满足后才返回该实体的 1 条 basic fact 与各条 detail fact。
26. `GET /api/v1/entities/actions/search` 只在“名称匹配 + basic_profile 命中”
    同时满足时返回结果，任一条件不满足则返回空数组。
27. `GET /api/v1/entities/actions/search` 按命中路径逐条返回结果；
    若同一 `entityId` 因不同匹配路径重复命中，则允许重复返回。
28. controller 接收 `domainClass`、`entry_code`、`profileEntryCodes[]` 字符串入参；
    service 负责查 `domain_dict` 与 `profile_entry_dict`，完成校验、`code/class -> id`
    解析与错误映射后，再调用 repository。
29. 单对象读取接口在资源不存在或当前时态无命中时返回 `404`；历史接口在无命中时返回
    `200 + items=[]`。
30. history 接口的 `total` 固定表示分页过滤后、实际可返回的记录总数。
31. history 分页规则固定为：`page` 从 `1` 开始，默认 `page=1,size=20`，`size`
    最大 `100`，非法分页参数返回 `400`。
32. 所有 `4xx` 错误响应统一使用 `ErrorResponse`：
    `{ code: string, message: string, details?: object }`。

### 参数类型约定（跨任务贯彻）

- `string`：UTF-8 字符串。
- `int32`：32 位整数。
- `int64`：64 位整数。
- `number`：数值型；落地实现时统一映射为 `BigDecimal` 或 `double`。
- `boolean`：布尔值。
- `timestamp`：RFC 3339 / ISO-8601 时间戳字符串，统一使用 UTC。
- `array<T>`：元素类型为 `T` 的数组。
- `object`：JSON 对象。
- `enum<...>`：枚举字符串。
- 所有 HTTP 响应默认 `Content-Type=application/json`。

### 错误响应约定（跨任务贯彻）

- `ErrorResponse`：`{ code: string, message: string, details?: object }`
- `details` 仅在参数校验失败、字典值非法、分页参数非法等需要补充上下文时出现。
- `domainClass` 缺失或未知值统一返回 `400` + `ErrorResponse`。
- `profileEntryCodes[]` 非法值或传入 `BASIC` 返回 `400` + `ErrorResponse`。
- `profiles/{entry_code}` 未知值返回 `404` + `ErrorResponse`；传入 `BASIC` 调用
  detail/history 路径返回 `400` + `ErrorResponse`。

### 服务外部消费契约（Phase 0 必做）

1. 只定义服务消费契约，不定义离线构建或调度流程。
2. 定稿对象路径规范：
   - `basic_profile`：
     `s3://<bucket>/<prefix>/<entity_id>/<entry_code>/<valid_from>.json`
     其中 `valid_from` 固定编码为 UTC ISO 基础格式 `yyyyMMdd'T'HHmmss'Z'`
   - `entity_profile`：
     `s3://<bucket>/<prefix>/<entity_id>/<entry_code>/<version>.json`
3. 定稿 blob JSON 最小结构：
   - `basic_profile`：
     `{ schemaVersion, entityId, domainClass, entryCode }`
   - `entity_profile`：
     `{ schemaVersion, entityId, entryCode, version, content }`
   - `basic_profile` 不承载 `summary` 或其他详情摘要
4. 定稿最小字典种子：
   - `domain_dict`：`finance`
   - `profile_entry_dict`：`BASIC(is_basic=true)`、`BIO(is_basic=false)`、
     `HONOR(is_basic=false)`
   - `entity.type` 与 `domainClass` 显式区分：
     `entity.type=person`，`domainClass=finance`
5. 准备最小联调/集成测试示例数据集，并作为 Phase 1/2 验收基线。
   - 单实体 `canonical` 完全命中
   - 同名异人多候选命中
   - `entity_basic_profile` 多段历史（open + closed）
   - `entity_profile` 多版本历史
   - 外部数据契约保证 blob 可用的样例

---

### Task 0.4：单数据源与配置结构

**文件：**

- `koduck-knowledge/src/main/resources/application.yml`
- `koduck-knowledge/src/main/java/com/koduck/knowledge/config/DataSourceConfig.java`

**详细要求：**

1. 配置前缀 `koduck.knowledge.datasource.*`，库名固定 `koduck_knowledge`。
2. 声明单个 `appDataSource`，供运行时只读查询使用。
3. 敏感项通过环境变量注入：
   - `KODUCK_KNOWLEDGE_DB_URL`
   - `KODUCK_KNOWLEDGE_APP_DB_USER`
   - `KODUCK_KNOWLEDGE_APP_DB_PASSWORD`
4. 运行时服务不依赖第二条写入数据源。

**验收标准：**

- [x] `application.yml` 键结构齐全。
- [x] `appDataSource` 可被注入。
- [x] 敏感项不出现在日志中。

---

### Task 0.5：Flyway 基线迁移

**文件：** `koduck-knowledge/src/main/resources/db/migration/V0001__baseline.sql`

**详细要求：**

1. 建立 Flyway 基线。
2. 不在本任务中创建数据库账号、权限或 schema。
3. 数据库账号、权限与 schema 初始化由 k8s/DBA/运维脚本负责。
4. 不在本任务中引入任何候选表、审核表、发布表。

**验收标准：**

- [x] Flyway 启动无错误。
- [x] `mvn test` 可在 Testcontainers Postgres 上复放迁移。
- [x] 文档明确运行时账号与 schema 不由 Flyway 创建。

---

### Task 0.6：`S3Uri` / `BlobLocation` URI 解析层

**文件：**

- `blob/S3Uri.java`
- `blob/BlobLocation.java`
- `blob/S3UriParser.java`

**详细要求：**

1. 当前 Phase 0 只落 `S3Uri` / `BlobLocation` 这类 URI 解析值对象。
2. 统一解析 `s3://<bucket>/<key>`，为后续查询 DTO 与测试夹具提供稳定的协议边界。
3. `BlobStore` 名称保留给未来真正需要对象存储 I/O 时再引入，不在当前 MVP 落地。
4. URI 规范：
   - `basic_profile`：`s3://<bucket>/<prefix>/<entity_id>/<entry_code>/<valid_from>.json`
   - `entity_profile`：`s3://<bucket>/<prefix>/<entity_id>/<entry_code>/<version>.json`
5. 当前任务不引入 AWS SDK client、MinIO I/O、`get/presign` 或任何对象内容访问逻辑。

**输入参数与类型：**

- `S3UriParser.parse(uri: string) -> BlobLocation`
- `uri`: `string`，必须为 `s3://<bucket>/<key>` 形式。

**输出参数与类型：**

- `BlobLocation.uri`: `string`
- `BlobLocation.bucket`: `string`
- `BlobLocation.key`: `string`

**验收标准：**

- [x] 单测覆盖 URI 解析与错误路径。
- [x] 文档明确：当前 MVP 不引入 `BlobStore`、不访问对象存储、也不生成 presigned URL。

---

### Task 0.7：本地开发 profile（可选）

**文件：** `koduck-knowledge/src/main/resources/application-local.yml`

**详细要求：**

1. 以本地 Postgres 为主；如需准备对象路径样例，可额外配置 MinIO endpoint。
2. 与 `koduck-backend` 错峰端口。
3. 使用单个运行时账号配置。

**验收标准：**

- [x] `SPRING_PROFILES_ACTIVE=local` 下服务能启动。
- [x] 如配置了 MinIO，仅作为可选样例环境，不作为当前 MVP 启动前置条件。

---

### Task 0.8：Testcontainers 集成测试脚手架

**文件：**

- `it/AbstractKnowledgeIT.java`
- `it/support/PostgresFixture.java`

**详细要求：**

1. 使用 `PostgreSQLContainer`。
2. 基类统一完成容器启动、Spring 注入、迁移复放。
3. fixture 只负责测试数据准备，不代表服务运行时写入能力。
4. MinIO fixture 若未来需要，仅作为可选扩展，不作为当前 MVP 集成测试前置条件。

**验收标准：**

- [x] `mvn verify -pl koduck-knowledge` 可独立执行 IT。
- [x] 无对象存储依赖也可完成当前 MVP 集成测试。

---

### Task 0.9：模块 README 与启动说明

**文件：** `koduck-knowledge/README.md`

**详细要求：**

1. 说明模块定位、依赖、只读服务边界。
2. 说明本地启动、测试、部署、环境变量。
3. 明确记录：事实构建与数据装载不在服务内完成。

**验收标准：**

- [x] README 覆盖启动、测试、配置、部署四部分。

---

### Task 0.10：log4j2 JSON 日志配置

**文件：**

- `koduck-knowledge/src/main/resources/log4j2.xml`
- `koduck-knowledge/src/main/resources/log4j2-local.xml`

**详细要求：**

1. 根配置使用 `JsonTemplateLayout`。
2. JSON 字段包含：
   `timestamp/level/logger/thread/message/request_id/entity_id/domain_class/profile_entry_id/trace_id/span_id`。
3. `application.yml` 指向 `classpath:log4j2.xml`。
4. 不再为 worker、审核流、发布流设计专用 MDC 字段。

**验收标准：**

- [x] 启动日志为合法 JSON。
- [x] 查询链路可按 `request_id` 串联。

---

### Task 0.11：Docker 构建链路（含 GraalVM Native Image）

**文件：**

- `koduck-knowledge/Dockerfile.build`
- `koduck-knowledge/Dockerfile`
- `koduck-knowledge/scripts/build.sh`
- `koduck-knowledge/pom.xml`
- `META-INF/native-image/...`

**详细要求：**

1. 统一 Docker 构建，禁止本地裸机发布构建。
2. `native` 为默认发布 profile，`jvm` 为 fallback。
3. 保证 Swagger UI、`S3Uri` / `BlobLocation` 解析层与日志在 Native 下可用。
4. Native Image 是 Phase 0 强验收项，不后移到 Phase 3 再补。

**验收标准：**

- [x] `./scripts/build.sh --profile native` 可产出可运行镜像。
- [x] `jvm` profile 可在 Docker 内回退。
- [x] Phase 0 完成前，native 启动链路必须已验证通过。

---

### Task 0.12：k8s 资源与部署脚本接入

**文件：**

- `k8s/base/koduck-knowledge/...`
- `k8s/overlays/{dev,prod}/koduck-knowledge/...`
- `k8s/overlays/dev/apisix-route-init.yaml`
- `k8s/overlays/prod/apisix-route-init.yaml`
- `k8s/deploy.sh`
- `k8s/uninstall.sh`

**详细要求：**

1. Deployment、Service、ConfigMap、Secret、HPA 完整。
2. 接入仓库统一 deploy/uninstall 脚本。
3. 在 dev/prod 的 `apisix-route-init` Job 中新增 knowledge northbound 路由：
   - `uri` 固化为 `/api/v1/entities/*`
   - `route id` 使用稳定命名（如 `knowledge-service`）
   - `priority` 必须高于现有 `/api/* -> backend` 通配路由
   - upstream 指向 `koduck-knowledge` Service
4. 对齐现有受保护 API 的鉴权与身份透传基线：
   - `plugins.jwt-auth = {}`
   - `plugins.proxy-rewrite.headers.set` 注入
     `X-User-Id=$jwt_claim_sub`、`X-Username=$jwt_claim_username`、
     `X-Roles=$jwt_claim_roles`、`X-Tenant-Id=$jwt_claim_tenant_id`
5. `koduck-knowledge` 服务侧以 APISIX 注入的身份头作为主身份来源，不新增服务内 JWT 验签。
6. 依赖 Postgres、APISIX 已可用；如需对象路径样例，可选配置 MinIO，但不作为当前 MVP 前置条件；不引入额外中间件。

**验收标准：**

- [x] `./k8s/deploy.sh dev` 能部署并通过健康检查。
- [x] `./k8s/uninstall.sh dev` 能干净卸载。
- [x] APISIX Admin API 可读到 `knowledge-service` 路由，且 `uri/priority/upstream/plugins`
      与设计一致。
- [x] Phase 0 只要求路由已注册且配置正确，不要求业务 northbound 转发链路已就绪。

---

## Phase 1：只读数据模型与名称匹配内核

### Task 1.1：Flyway 迁移 `V0002__base_dicts.sql`

1. 建 `domain_dict(domain_class PK, display_name, description)`。
2. 建 `profile_entry_dict(profile_entry_id PK, code UNIQUE, is_basic BOOLEAN)`。
3. 初始化 MVP 正式种子：
   - `domain_dict`：`finance`
   - `profile_entry_dict`：`BASIC`、`BIO`、`HONOR`

**验收标准：**

- [x] 迁移成功。
- [x] 集成测试可复放种子。
- [x] 文档、迁移与测试中的种子集合保持一致。

---

### Task 1.2：Flyway 迁移 `V0003__entity_tables.sql`

1. 建 `entity(entity_id, canonical_name, type, created_at)`。
2. 建 `entity_alias(alias_id, entity_id, alias, lang, source)`。
3. 保留 `UNIQUE(entity_id, alias, lang)`。
4. 建索引：`entity_alias(alias)`、`entity(canonical_name)`。
5. 同名异人允许共享 `alias + lang`，查询时返回多候选。

**验收标准：**

- [x] 迁移成功。
- [x] alias 查询走索引。

---

### Task 1.3：Flyway 迁移 `V0004__profile_tables.sql`

1. 建 `entity_basic_profile`：
   - PK=`(entity_id, domain_class, valid_from)`
   - 包含 `entity_name/valid_to/basic_profile_entry_id/basic_profile_s3_uri`
2. 建 `entity_profile`：
   - `profile_id BIGSERIAL PK`
   - 包含 `entity_id/profile_entry_id/blob_uri/version/is_current/loaded_at`
   - `UNIQUE (entity_id, profile_entry_id, version)`
3. 建约束：
   - `ux_entity_profile_current`
   - `CHECK (valid_to IS NULL OR valid_to > valid_from)`
4. `is_basic=true` 仅允许进入 `entity_basic_profile`，该规则在应用层校验，不通过物理 FK 或 DB trigger 强制。
5. `entity_basic_profile` 的开放段唯一与时间段不重叠不由 `koduck-knowledge`
   运行时治理；当前服务消费契约假设同一 `(entity_id, domain_class, at)` 至多命中一段有效记录。

**验收标准：**

- [x] 同表约束（`valid_to > valid_from`、`current` 唯一）由 DB 拒绝。
- [x] 跨表规则（`is_basic` 错表写入）由应用层单测与集成测试覆盖。
- [x] `entity_basic_profile` 的时态正确性作为服务外部前置条件写入文档与 fixture，不新增服务内治理逻辑。

---

### Task 1.4：JPA 实体与只读 Repository

1. Repository 仅暴露 `findBy*`、分页、排序等只读能力。
2. 禁止暴露 `save/delete/deleteAll`。
3. 运行时仅依赖单个 `appDataSource`。
4. 字典解析责任固定在 service 层；repository 不直接承接外部 `domainClass` /
   `entryCode` 字符串校验逻辑。

**输入参数与类型：**

- `EntityRepository.findByCanonicalName(name: string) -> array<EntityRecord>`
- `EntityRepository.findByCanonicalNamePrefix(prefix: string) -> array<EntityRecord>`
- `EntityRepository.findByEntityId(entityId: int64) -> EntityRecord?`
- `EntityAliasRepository.findByAlias(alias: string) -> array<EntityAliasRecord>`
- `EntityAliasRepository.findByAliasPrefix(prefix: string) -> array<EntityAliasRecord>`
- `DomainDictRepository.findByDomainClass(domainClass: string) -> DomainDictRecord?`
- `ProfileEntryDictRepository.findByCode(code: string) -> ProfileEntryDictRecord?`
- `EntityBasicProfileRepository.findByEntityIdAndDomainClassAt(entityId: int64, domainClass: string, at: timestamp) -> BasicProfileRecord?`
- `EntityBasicProfileRepository.findHistoryByEntityIdAndDomainClass(entityId: int64, domainClass: string, page: int32, size: int32) -> Page<BasicProfileRecord>`
- `EntityProfileRepository.findCurrentByEntityIdAndProfileEntryId(entityId: int64, profileEntryId: int32) -> EntityProfileRecord?`
- `EntityProfileRepository.findHistoryByEntityIdAndProfileEntryId(entityId: int64, profileEntryId: int32, page: int32, size: int32) -> Page<EntityProfileRecord>`

**输出参数与类型：**

- `EntityRecord`: `{ entityId: int64, canonicalName: string, type: string, createdAt: timestamp }`
- `EntityAliasRecord`: `{ aliasId: int64, entityId: int64, alias: string, lang: string, source: string }`
- `DomainDictRecord`: `{ domainClass: string, displayName: string, description?: string }`
- `ProfileEntryDictRecord`: `{ profileEntryId: int32, code: string, isBasic: boolean }`
- `BasicProfileRecord`: `{ entityId: int64, domainClass: string, entityName: string, validFrom: timestamp, validTo?: timestamp, basicProfileEntryId: int32, basicProfileS3Uri: string }`
- `EntityProfileRecord`: `{ profileId: int64, entityId: int64, profileEntryId: int32, blobUri: string, version: int32, isCurrent: boolean, loadedAt: timestamp }`
- `Page<T>`: `{ items: array<T>, page: int32, size: int32, total: int64 }`

**验收标准：**

- [x] 只读 Repository 接口清晰分层。
- [x] `domain_dict` 与 `profile_entry_dict` 的 lookup repository 已提供，且字典解析不下沉到 controller。
- [x] repository 契约已覆盖 canonical/alias 的完全匹配、前缀匹配，以及 `entityId -> entity` 回查能力。
- [x] repository 契约已覆盖 basic current read 与 basic history 分页读取能力。
- [x] 单测覆盖基础查询路径。

---

### Task 1.5：`DictionaryResolver`

1. 新增 service 层共享解析能力，统一承接 `domain_dict` 与 `profile_entry_dict` 的 lookup、
   校验与 `code/class -> id` 解析。
2. controller 不直接做字典解析；repository 不直接承接外部字符串校验。
3. `search/facts/detail/history` 后续全部复用该共享能力，避免各接口重复实现。
4. 当前阶段只做读取、校验与解析，不引入缓存、写回或治理逻辑。

**输入参数与类型：**

- `DictionaryResolver.resolveDomainClass(domainClass: string) -> DomainDictRecord`
- `DictionaryResolver.resolveProfileEntryCode(code: string) -> ProfileEntryDictRecord`
- `DictionaryResolver.resolveNonBasicProfileEntryCodes(codes: array<string>) -> array<ProfileEntryDictRecord>`

**输出参数与类型：**

- `DomainDictRecord`: `{ domainClass: string, displayName: string, description?: string }`
- `ProfileEntryDictRecord`: `{ profileEntryId: int32, code: string, isBasic: boolean }`

**验收标准：**

- [x] `domainClass` 与 `entryCode/profileEntryCodes` 的解析逻辑只在这一处集中实现。
- [x] `search/facts/detail/history` 不再各自散落实现字典校验。
- [x] 单测覆盖成功路径与失败路径。

---

### Task 1.6：`EntitySearchService`

1. 输入：`name`、`domainClass`、`at?`。
2. 名称匹配来源：`entity_alias` + `entity.canonical_name`。
3. 先做 `trim`、大小写折叠与全半角统一。
4. 排序固定为：
   `canonical` 完全匹配 > `alias` 完全匹配 >
   `canonical` 前缀匹配 > `alias` 前缀匹配。
5. MVP 不引入编辑距离、拼音近似或其他模糊匹配。
6. `matchType` 固定枚举为：
   - `CANONICAL_EXACT`
   - `ALIAS_EXACT`
   - `CANONICAL_PREFIX`
   - `ALIAS_PREFIX`
7. 名称命中后，必须继续读取当前 `domainClass + at` 下有效的
   `entity_basic_profile`；任一条件不满足则过滤该结果。
8. 同名异人允许返回多个结果；若同一 `entityId` 同时命中多条路径，也允许重复返回。
9. 同分按 `entity_id` 升序稳定返回。
10. 返回 `SearchHit[]`。

**输入参数与类型：**

- `name`: `string`
- `domainClass`: `string`
- `at?`: `timestamp`

**输出参数与类型：**

- `array<SearchHit>`
- `SearchHit.entityId`: `int64`
- `SearchHit.canonicalName`: `string`
- `SearchHit.entityName`: `string`
- `SearchHit.matchType`: `enum<CANONICAL_EXACT | ALIAS_EXACT | CANONICAL_PREFIX | ALIAS_PREFIX>`
- `SearchHit.basicProfileS3Uri`: `string`
- `SearchHit.validFrom`: `timestamp`
- `SearchHit.validTo?`: `timestamp`

**验收标准：**

- [x] 单测覆盖完全匹配、多候选、同名异人、空命中。
- [x] 单测覆盖大小写、全半角与 tie-break 行为。
- [x] 单测覆盖“名称命中但 basic_profile 不存在/过期时返回空”的行为。
- [x] 单测覆盖同一 `entityId` 多命中路径时允许重复返回的行为。
- [x] 搜索排序与返回结果稳定可复现。

---

### Task 1.7：应用层单测覆盖关键规则

1. search 内部名称匹配排序、命中路径与 tie-break。
2. `is_basic` 错表路径在应用层的拦截。
3. 时态过滤、空洞段、开放段行为。

**验收标准：**

- [x] Phase 1 新增代码行覆盖 ≥ 80%。
- [x] 单测不依赖真实 DB。

---

### Task 1.8：集成测试（只读模型）

1. Flyway 全量迁移成功。
2. 基于 fixture 装载测试数据后，搜索命中正确。
3. 同名异人共享同一 `alias + lang` 时，返回多个搜索结果。
4. 历史版本、开放段、闭合段场景覆盖。

**验收标准：**

- [x] 全部集成测试在 `mvn verify` 下绿。
- [x] 重复执行 10 次无 flakiness。

---

## Phase 2：查询接口

### Task 2.1：`GET /api/v1/entities/actions/search`

1. 入参：`name`、`domainClass`（必填）、`at`。
2. 流程：执行名称匹配 → 读取 `entity_basic_profile` →
   返回 `SearchHit[]`。
3. 排序只允许基于名称匹配信号与时间有效性。
4. `SearchHit` 同时返回 `canonicalName` 与 `entityName`，前者为稳定规范名，后者为时态展示名。
5. 任一条件不满足时，该实体不返回；最终可返回空数组。
6. 未传 `at` 时，统一按请求处理时刻的 `now()` 执行查询。
7. 按命中路径逐条返回；若同一 `entityId` 同时命中多条匹配路径，允许重复返回多条 `SearchHit`。

**输入参数与类型：**

- `name`: `string`
- `domainClass`: `string`
- `at?`: `timestamp`

**输出参数与类型：**

- `array<SearchHit>`
- `SearchHit.entityId`: `int64`
- `SearchHit.canonicalName`: `string`
- `SearchHit.entityName`: `string`
- `SearchHit.matchType`: `enum<CANONICAL_EXACT | ALIAS_EXACT | CANONICAL_PREFIX | ALIAS_PREFIX>`
- `SearchHit.basicProfileS3Uri`: `string`
- `SearchHit.validFrom`: `timestamp`
- `SearchHit.validTo?`: `timestamp`

**验收标准：**

- [x] 单段、多段、闭合段、开放段场景覆盖。
- [x] 同名异人场景可返回多个 `entity_id`。
- [x] 名称命中但 basic_profile 不存在或时态无命中时返回空结果。
- [x] 同一 `entityId` 多命中路径重复返回的行为有测试覆盖。
- [x] 缺失 `domainClass` 返回 `400`。
- [x] 未知 `domainClass` 返回 `400`。
- [x] 缺失 `at` 时按 `now()` 查询的行为有单测/集成测试覆盖。

---

### Task 2.2：`POST /api/v1/entities/actions/facts`

1. 输入：`{ entityIds: number[], domainClass: string, at?: timestamp, profileEntryCodes?: string[] }`。
2. 返回：`EntityFactView[]`。
3. 本接口只返回事实，不返回结论。
4. 响应保持扁平数组，不按 `entityId` 分组。
5. 默认返回 raw `s3://...` URI 与元信息，不默认返回 presigned URL。
6. 未传 `profileEntryCodes` 时只返回 basic facts；传入时仅追加指定 non-basic detail 元信息。
7. `profileEntryCodes` 只接受大写 non-basic `code`；未知值或传入 `BASIC` 返回 `400`。
8. 未传 `at` 时，统一按请求处理时刻的 `now()` 执行查询。
9. 采用“按实体全满足才返回”的规则：
   - 该 `entityId` 必须先命中当前 `domainClass + at` 下有效的 basic fact；
   - 若请求了 `profileEntryCodes[]`，这些 entry 必须全部命中；
   - 任一条件不满足，则该 `entityId` 不返回任何记录。
10. 满足全部条件后，返回该实体的 1 条 basic fact 与每个请求 detail entry 的 1 条记录。

**输入参数与类型：**

- `entityIds`: `array<int64>`
- `domainClass`: `string`
- `at?`: `timestamp`
- `profileEntryCodes?`: `array<string>`

**输出参数与类型：**

- `array<EntityFactView>`
- `EntityFactView.entityId`: `int64`
- `EntityFactView.domainClass`: `string`
- `EntityFactView.entityName`: `string`
- `EntityFactView.basicProfileS3Uri`: `string`
- `EntityFactView.validFrom`: `timestamp`
- `EntityFactView.validTo?`: `timestamp`
- `EntityFactView.profileEntryCode?`: `string`
- `EntityFactView.blobUri?`: `string`

**验收标准：**

- [x] `domainClass` 缺失返回 `400`。
- [x] 未知 `domainClass` 返回 `400`。
- [x] 默认只批量返回基础事实；传入 `profileEntryCodes` 时可追加对应详情元信息。
- [x] `profileEntryCodes` 非法值返回 `400`。
- [x] 缺失 `at` 时按 `now()` 查询的行为有测试覆盖。
- [x] 某个 `entityId` 只要缺任一所需 record，就整体不返回。
- [x] 响应展开规则固定为“满足条件后 1 条 basic + 每个请求的 detail entry 各 1 条记录”。

---

### Task 2.3：详情接口

**端点：**

- `GET /api/v1/entities/{id}/basic-profile?domainClass={domainClass}&at={at}`
- `GET /api/v1/entities/{id}/profiles/{entry_code}`

**详细要求：**

1. basic 路径按 `(entity_id, domainClass, at)` 定位事实段。
2. 非 basic 路径返回 `is_current = true` 的详情分片 raw URI 与元信息。
3. `entry_code` 固定使用大写字典 code。
4. basic / 非 basic 交叉调用统一返回 `400`。
5. 未知 `entry_code` 返回 `404`。
6. `GET /api/v1/entities/{id}/basic-profile` 未传 `at` 时，统一按请求处理时刻的 `now()` 执行查询。
7. 资源不存在或当前时态无命中时返回 `404`。
8. `domainClass` 缺失或未知值统一返回 `400` + `ErrorResponse`。

**输入参数与类型：**

- `GET /api/v1/entities/{id}/basic-profile`
- `id`: `int64`
- `domainClass`: `string`
- `at?`: `timestamp`
- `GET /api/v1/entities/{id}/profiles/{entry_code}`
- `id`: `int64`
- `entry_code`: `string`

**输出参数与类型：**

- `BasicProfileView`: `{ entityId: int64, canonicalName: string, entityName: string, domainClass: string, validFrom: timestamp, validTo?: timestamp, basicProfileS3Uri: string }`
- `ProfileDetailView`: `{ entityId: int64, entryCode: string, version: int32, isCurrent: boolean, blobUri: string, loadedAt: timestamp }`

**验收标准：**

- [x] P95 ≤ 50ms（不含 blob 下载）。
- [x] 路由互不串位。
- [x] `BASIC` 调用 detail 路径返回 `400`，未知 `entry_code` 返回 `404`。
- [x] `domainClass` 缺失或未知值返回 `400`。
- [x] basic-profile 缺失 `at` 时按 `now()` 查询的行为有测试覆盖。
- [x] 当前任务不引入 blob 运行时探测逻辑。

---

### Task 2.4：历史接口

**端点：**

- `GET /api/v1/entities/{id}/basic-profile/history?domainClass={domainClass}`
- `GET /api/v1/entities/{id}/profiles/{entry_code}/history`

**详细要求：**

1. basic 历史返回段列表。
2. 非 basic 历史返回版本列表。
3. 使用 `page` + `size` 分页，并返回 `{ items, page, size, total }`。
4. `entry_code` 固定使用大写字典 code；`BASIC` 调用 detail history 路径返回 `400`，
   未知 `entry_code` 返回 `404`。
5. 不返回完整 blob，不默认返回 presigned URL。
6. 分页规则固定为：`page` 从 `1` 开始，默认 `page=1,size=20`，`size` 最大 `100`，
   非法分页参数返回 `400`。
7. 无命中时返回 `200 + items=[]`。
8. `total` 表示当前过滤与分页规则下实际可返回记录总数。
9. `domainClass` 缺失或未知值统一返回 `400` + `ErrorResponse`。

**输入参数与类型：**

- `GET /api/v1/entities/{id}/basic-profile/history`
- `id`: `int64`
- `domainClass`: `string`
- `page`: `int32`
- `size`: `int32`
- `GET /api/v1/entities/{id}/profiles/{entry_code}/history`
- `id`: `int64`
- `entry_code`: `string`
- `page`: `int32`
- `size`: `int32`

**输出参数与类型：**

- `BasicProfileHistoryPage`: `{ items: array<BasicProfileSegment>, page: int32, size: int32, total: int64 }`
- `BasicProfileSegment`: `{ entityId: int64, domainClass: string, entityName: string, validFrom: timestamp, validTo?: timestamp, basicProfileS3Uri: string }`
- `ProfileHistoryPage`: `{ items: array<ProfileVersionView>, page: int32, size: int32, total: int64 }`
- `ProfileVersionView`: `{ entityId: int64, entryCode: string, version: int32, isCurrent: boolean, blobUri: string, loadedAt: timestamp }`

**验收标准：**

- [x] basic 段按 `valid_from` 降序稳定。
- [x] 非 basic 版本按 `version` 降序稳定。
- [x] 分页参数与返回 envelope 稳定。
- [x] 默认分页值、最大 `size` 与非法分页参数 `400` 的行为有测试覆盖。
- [x] `domainClass` 缺失或未知值返回 `400`。
- [x] `total` 的定义与文档一致。
- [x] 无命中时返回 `200 + items=[]` 的行为有测试覆盖。

---

### Task 2.5：只读契约测试

1. 确认当前 MVP 无业务写接口。
2. 对未开放的 `POST/PUT/PATCH/DELETE` 资源返回 404/405。
3. OpenAPI 文档不暴露写入、审核、发布相关路径，也不暴露独立 `link` 接口。
4. 经 APISIX 访问 `/api/v1/entities/*` 时，请求命中 knowledge 显式路由，而不是 `/api/*`
   通配 backend 路由。
5. knowledge 显式路由的插件配置需与现有受保护 API 一致，至少包含 `jwt-auth` 与
   `proxy-rewrite(headers.set)` 的四个身份头映射。
6. `search` 的 `domainClass` 缺失或未知值返回 `400`；detail/history 的 `entry_code` 错误码符合契约。
7. `facts` 的 `domainClass` 缺失或未知值返回 `400`，且 `profileEntryCodes` 非法值返回 `400`。
8. history 接口分页参数与 envelope 与文档一致。
9. 单对象读取无命中返回 `404`；history 无命中返回 `200 + items=[]`。
10. history 默认分页值、最大 `size`、`total` 定义与非法分页参数 `400` 与文档一致。
11. 所有 `4xx` 响应 body 均符合 `ErrorResponse { code, message, details? }` 契约。

**验收标准：**

- [x] 只读契约测试通过。
- [x] OpenAPI 输出与文档边界一致。
- [x] Phase 0 仅通过 APISIX Admin API 与配置检查验证 knowledge 路由生效；northbound 端到端 smoke test 放到 Phase 2/3。
- [x] APISIX Admin API 可验证路由优先级、`jwt-auth` 和身份头透传配置生效。

---

## Phase 3：观测、压测与部署验证

### Task 3.1：观测指标与日志

1. 输出指标：
   - `knowledge_search_latency_ms`
   - `knowledge_query_throughput`
   - `knowledge_profile_read_latency_ms`
2. 结构化日志字段复用 Task 0.10 的 MDC 定义。
3. 暴露 `/actuator/prometheus`。

**验收标准：**

- [x] 指标按维度可查。
- [x] 日志可按 `request_id` 串链。

---

### Task 3.2：性能基线

1. `GET /entities/actions/search` P95 ≤ 100ms。
2. `POST /entities/actions/facts` P95 ≤ 150ms。
3. `GET /entities/{id}/profiles/{entry_code}` P95 ≤ 50ms。
4. 形成压测报告与瓶颈清单。

**验收标准：**

- [x] 压测报告产出并纳入 `docs/`。
- [x] 明确扩容阈值与优化项。

---

### Task 3.3：部署验证

1. 在本地与 dev 环境验证 Native 镜像启动、健康检查、Swagger UI、Prometheus，以及可选对象存储配置不会影响当前 MVP 启动。
2. 校验只读配置下服务能稳定启动与处理查询流量。
3. 通过 APISIX 网关验证 `/api/v1/entities/*` northbound 路由可达，未认证请求返回 401。
4. 验证 APISIX 已透传 `X-User-Id`、`X-Username`、`X-Roles`、`X-Tenant-Id`，且服务按此消费。

**验收标准：**

- [x] dev 环境部署通过。
- [x] 关键查询接口 smoke test 通过。
- [x] 网关入口与直连 Service 的返回一致。
- [x] 网关鉴权失败与成功路径都符合 `jwt-auth` 基线预期。

---

## Phase 4（预留）：写入链路或事实构建能力

当前 MVP 不纳入。如果未来需要在 `koduck-knowledge` 内提供数据写入、审核、发布或事实构建能力，必须单独新增 ADR，不得直接恢复旧治理链任务。

---

## 关键里程碑

- M0（Phase 0 完成）：项目骨架、`S3Uri` / `BlobLocation` 解析层、Swagger UI、Testcontainers、构建链路打通。
- M0 还需满足：Native Image 启动链路已作为强验收项通过。
- M1（Phase 1 完成）：只读数据模型与名称匹配跑通。
- M2（Phase 2 完成）：查询接口闭环达成。
- M3（Phase 3 完成）：观测、压测、部署验证达成。

---

## 非功能要求

| 项 | 要求 |
| ------ | ------ |
| 服务边界 | 当前 MVP 仅提供读接口，不提供运行时写接口 |
| 数据模型 | 支持多候选、多段历史、详情版本化 |
| 可观测性 | Prometheus + 结构化日志，覆盖 search / facts / profile read |
| 性能基线 | search P95 ≤ 100ms，facts P95 ≤ 150ms，详情读取 P95 ≤ 50ms |
| 可部署性 | Docker 内统一构建，Native Image 默认发布且 Phase 0 必须验收通过 |
| 一致性 | OpenAPI、设计文档、实施方案都必须体现只读边界 |

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
| ------ | ------ | ------ |
| 名称匹配规则不足 | 召回率下降 | Phase 1 先规则式实现，后续再评估模型化 |
| 同名异人歧义 | 返回多个候选，调用方需自行判定 | 保留多候选召回，不在服务内提前裁剪 |
| 多段历史约束遗漏 | 查询结果错误 | DB 约束 + 应用层断言 + 集成测试 |
| 数据新鲜度依赖外部装载 | 服务返回旧事实 | 在文档中明确外部装载责任，并做好数据更新时间可观测性 |
| S3 URI 规范漂移 | URI 解析错误或环境不一致 | 用解析器单测与 fixture 样例覆盖对象路径规范 |
| 无写接口导致人工修正链路缺失 | 修数需额外流程 | 明确当前范围，仅通过外部流程修正数据 |

---

## 当前状态追踪

| Phase | 状态 | Owner | 备注 |
| ------- | ------ | ------- | ------ |
| 0 | 已完成 | @guhailin | `feature/knowledge-bootstrap` worktree、模块骨架、Flyway、README、日志、Docker、k8s 接入已落地 |
| 1 | 已完成 | @guhailin | 只读模型、Repository、`DictionaryResolver`、名称匹配与单测已落地 |
| 2 | 已完成 | @guhailin | `search/facts/detail/history` 接口、DTO、契约测试与 native 本地查询 smoke 已落地 |
| 3 | 已完成 | @guhailin | Micrometer/Prometheus、性能基线文档、本地 native 启动、网关资源接入、Testcontainers 集成测试与 native 日志验证已完成 |
| 4 | 预留 | - | MVP 之外 |

---

## 任务执行规范

1. Phase 0 默认使用一个 worktree、汇总为一个 PR；Phase 1/2 再按变更面拆分 PR，PR 标题遵循 Conventional Commits。
2. schema 变更必须走 Flyway 新迁移，不得修改已发布迁移文件。
3. 每个 Phase 完成后更新本文件状态并附 PR 链接。
4. 所有跨服务联调保留 `request_id` / `trace_id` 样例。
5. 当前 MVP 不得新增任何运行时写接口，除非先补 ADR。

---

## 变更日志

| 日期 | 变更 | 作者 |
| ------ | ------ | ------ |
| 2026-04-17 | 初始版本，对齐 ADR-0001 | @guhailin |
| 2026-04-17 | 收口到只读事实查询服务：移除候选、审核、发布相关任务；改单数据源与只读查询接口为主线 | @guhailin |
| 2026-04-17 | 补充 APISIX 注册要求，并对齐现有鉴权基线 | @guhailin |
| 2026-04-17 | 定稿消费契约、raw URI 返回、应用层跨表校验、Entity Linking MVP 规则与 Phase 0 native 强验收 | @guhailin |
| 2026-04-17 | 补充未知 `domainClass` 统一 `400`、service 层字典解析、`BlobStore` 仅 URI 解析职责与统一 `ErrorResponse` 契约 | @guhailin |
| 2026-04-17 | 新增独立 `DictionaryResolver` 任务，并将 Phase 0 收口为 `S3Uri` / `BlobLocation` URI 解析层；`BlobStore` 名称预留到未来 I/O 能力 | @guhailin |
| 2026-04-17 | 移除 search `confidence`、删除 repository `find...Now`、将 MinIO 降为可选样例能力，并将 `DictionaryResolver` 新增异常验收收口为成功/失败 | @guhailin |
| 2026-04-17 | `koduck-knowledge` 实现已在独立 worktree 落地，并完成本地 native smoke、Prometheus 验证、查询接口 smoke、Testcontainers 集成测试收口与 native Log4j2 启动告警修复 | @guhailin |
