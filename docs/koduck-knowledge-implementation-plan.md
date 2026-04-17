# Koduck Knowledge 实施任务清单

> 本文档基于 `docs/design/entity-knowledge-base-design.md` 与
> `docs/implementation/adr-0001-koduck-knowledge-mvp-architecture.md` 拆分，
> 提供 step-by-step 可执行任务。
>
> **状态**: 待执行（Phase 0 未开始）
> **创建日期**: 2026-04-17
> **负责人**: @guhailin
> **对应设计文档**: [entity-knowledge-base-design.md](design/entity-knowledge-base-design.md)
> **对应 ADR**: [adr-0001-koduck-knowledge-mvp-architecture.md](implementation/adr-0001-koduck-knowledge-mvp-architecture.md)

## 范围与目标

### MVP 目标

跑通“人 × domain 关联”的只读事实查询闭环：

1. 实体标准化查询（Entity Linking）。
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
仅通过 Maven 共享 `koduck-bom` 与 `koduck-common` 等公共依赖。

| 主题 | 落点 | 当前要求 |
| ------ | ------ | ---------- |
| 与 `koduck-backend` 的关系 | 全阶段 | 独立项目，只共享公共 Maven 依赖；禁止引用其运行时代码 |
| 服务职责 | 全阶段 | 当前 MVP 仅提供只读查询接口，不承担运行时写入 |
| 数据构建与装载 | 服务外部 | 由离线流程、数据构建服务或运维脚本负责，不在 `koduck-knowledge` 内实现 |
| Entity Linking | Phase 1 / Phase 2 | 由 `koduck-knowledge` 提供查询时标准化与多候选召回 |
| 对象存储 | Phase 0 / Phase 1 | 默认 S3 协议，本地接 `koduck-dev` MinIO，禁止直连文件系统 |
| 日志方案 | Phase 0 全阶段 | slf4j + log4j2 + JSON 格式；Spring Boot 默认 logback 必须排除 |
| API 文档 | Phase 0 全阶段 | 集成 `springdoc-openapi-starter-webmvc-ui`，代码即契约 |
| 构建形态 | Phase 0 / Phase 3 | 统一在 Docker 容器内构建；禁止本地裸机构建发布产物 |
| 构建与部署 | Phase 0 / Phase 3 | GraalVM Native Image 作为默认发布形态，保留 `jvm` profile |
| APISIX 注册 | Phase 0 / Phase 2 | 注册 knowledge 显式路由并对齐 `jwt-auth` 基线 |
| k8s 接入 | Phase 0 | 纳入仓库 `k8s` 目录与统一 `deploy/uninstall` 脚本 |
| 网关 / 鉴权 | Phase 2 | 对齐 `jwt-auth + proxy-rewrite` 与四个身份头透传 |

> 当前 MVP 的前提是：数据库与对象存储中的事实已经由服务外部准备完成。
> `koduck-knowledge` 运行时只负责查询、过滤、组装与返回。

---

## 执行阶段概览

| 阶段 | 名称 | 依赖 | 优先级 |
| ------ | ------ | ------ | -------- |
| Phase 0 | 项目骨架与基础设施 | ADR-0001 | P0 |
| Phase 1 | 只读数据模型与 Entity Linking 内核 | Phase 0 | P0 |
| Phase 2 | 查询接口（link/search/facts/detail/history） | Phase 1 | P0 |
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

- [ ] worktree 创建成功，分支从最新 `dev` 派生。
- [ ] `git branch --show-current` 返回 `feature/knowledge-bootstrap`。

---

### Task 0.2：新建 Maven 模块 `koduck-knowledge`

**文件：** `koduck-knowledge/pom.xml`

**详细要求：**

1. 独立顶层项目，与 `koduck-backend` 并列。
2. 包结构：
   `com.koduck.knowledge.{app,api,service,repository,entity,dto,blob,config,exception}`。
3. 引入 Spring Boot 3.x、Spring Data JPA、Flyway、AWS SDK v2、Testcontainers、
   `springdoc-openapi-starter-webmvc-ui`。
4. 排除 `spring-boot-starter-logging`，启用 `spring-boot-starter-log4j2`。
5. 启用 GraalVM Native Image 所需 Maven 插件与 profile。

**验收标准：**

- [ ] Docker 构建能完成 `mvn compile`。
- [ ] 依赖树中不含 `koduck-backend` 与 `logback-classic`。
- [ ] 包结构符合仓库 Java 规范。

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

- [ ] 镜像启动后能响应健康检查。
- [ ] Swagger UI 可访问。
- [ ] 能导出 `openapi.yaml`。

---

### API 契约规范（跨任务贯彻）

1. 所有业务端点统一使用 `/api/v1/...` 前缀。
2. 字面量路由段必须先于 `/{id}` 注册。
3. Controller 使用 `@Operation` / `@Parameter`，DTO 使用 `@Schema`。
4. 统一 DTO：
   - `EntityCandidate`：`{ entityId, canonicalName, confidence, matchType }`
   - `SearchHit`：在 `EntityCandidate` 上扩展
     `{ basicProfileS3Uri, validFrom, validTo }`
   - `EntityFactView`：
     `{ entityId, domainClass, entityName, basicProfileS3Uri, validFrom, validTo,
     profileEntryCode?, blobUri? }`
   - `LinkContext`：
     `{ at?: timestamp, domainHints?: string[], textSnippet?: string }`
5. 同名异人必须返回多候选，不得在服务内提前裁剪为单一实体。
6. 当前 MVP 不暴露任何 Create / Update / Delete 业务接口。
7. 错误模型对齐 `koduck-common`。
8. 对外暴露必须通过 APISIX 显式注册 `/api/v1/entities/*`，不得依赖现有 `/api/*`
   通配路由兜底到 `backend`。
9. knowledge 路由鉴权方式对齐现有受保护 API：启用 `jwt-auth`，并通过 `proxy-rewrite`
   注入 `X-User-Id`、`X-Username`、`X-Roles`、`X-Tenant-Id`；服务侧以网关注入身份头为主，
   不自行解析外部 JWT 作为主路径。

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

- [ ] `application.yml` 键结构齐全。
- [ ] `appDataSource` 可被注入。
- [ ] 敏感项不出现在日志中。

---

### Task 0.5：Flyway 基线迁移

**文件：** `koduck-knowledge/src/main/resources/db/migration/V0001__baseline.sql`

**详细要求：**

1. 创建 `koduck_knowledge` schema（如缺失）。
2. 建立 Flyway 基线。
3. 创建运行时账号占位 `koduck_knowledge_app`。
4. 不在本任务中引入任何候选表、审核表、发布表。

**验收标准：**

- [ ] Flyway 启动无错误。
- [ ] `mvn test` 可在 Testcontainers Postgres 上复放迁移。

---

### Task 0.6：`BlobStore` 抽象与 S3 实现

**文件：**

- `blob/BlobStore.java`
- `blob/S3BlobStore.java`
- `blob/BlobStoreProperties.java`

**详细要求：**

1. 定义 `put/get/delete/presign` 接口。
2. `S3BlobStore` 基于 AWS SDK v2，支持 MinIO endpoint。
3. URI 规范：`s3://<bucket>/<prefix>/<entity_id>/<entry_code>/<version>.json`。

**验收标准：**

- [ ] 单测覆盖四个方法与错误路径。
- [ ] 敏感配置脱敏输出。

---

### Task 0.7：本地开发 profile

**文件：** `koduck-knowledge/src/main/resources/application-local.yml`

**详细要求：**

1. 指向本地 Postgres 与 MinIO。
2. 与 `koduck-backend` 错峰端口。
3. 使用单个运行时账号配置。

**验收标准：**

- [ ] `SPRING_PROFILES_ACTIVE=local` 下服务能启动。
- [ ] BlobStore 能读写本地 MinIO。

---

### Task 0.8：Testcontainers 集成测试脚手架

**文件：**

- `it/AbstractKnowledgeIT.java`
- `it/support/{PostgresFixture,MinioFixture}.java`

**详细要求：**

1. 使用 `PostgreSQLContainer` 与 `GenericContainer`（MinIO）。
2. 基类统一完成容器启动、Spring 注入、迁移复放。
3. fixture 只负责测试数据准备，不代表服务运行时写入能力。

**验收标准：**

- [ ] `mvn verify -pl koduck-knowledge` 可独立执行 IT。
- [ ] 无外部环境依赖。

---

### Task 0.9：模块 README 与启动说明

**文件：** `koduck-knowledge/README.md`

**详细要求：**

1. 说明模块定位、依赖、只读服务边界。
2. 说明本地启动、测试、部署、环境变量。
3. 明确记录：事实构建与数据装载不在服务内完成。

**验收标准：**

- [ ] README 覆盖启动、测试、配置、部署四部分。

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

- [ ] 启动日志为合法 JSON。
- [ ] 查询链路可按 `request_id` 串联。

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
3. 保证 Swagger UI、BlobStore、日志在 Native 下可用。

**验收标准：**

- [ ] `./scripts/build.sh --profile native` 可产出可运行镜像。
- [ ] `jvm` profile 可在 Docker 内回退。

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
6. 依赖 Postgres、MinIO、APISIX 已可用；不引入额外中间件。

**验收标准：**

- [ ] `./k8s/deploy.sh dev` 能部署并通过健康检查。
- [ ] `./k8s/uninstall.sh dev` 能干净卸载。
- [ ] APISIX Admin API 可读到 `knowledge-service` 路由，且 `uri/priority/upstream/plugins`
      与设计一致。
- [ ] 未携带合法 JWT 的 northbound 请求经 APISIX 返回 401，携带合法 JWT 的请求可被正常转发。

---

## Phase 1：只读数据模型与 Entity Linking 内核

### Task 1.1：Flyway 迁移 `V0002__base_dicts.sql`

1. 建 `domain_dict(domain_class PK, display_name, description)`。
2. 建 `profile_entry_dict(profile_entry_id PK, code UNIQUE, is_basic BOOLEAN)`。
3. 初始化 `BASIC`、`BIO`、`HONOR` 等示例条目。

**验收标准：**

- [ ] 迁移成功。
- [ ] 集成测试可复放种子。

---

### Task 1.2：Flyway 迁移 `V0003__entity_tables.sql`

1. 建 `entity(entity_id, canonical_name, type, created_at)`。
2. 建 `entity_alias(alias_id, entity_id, alias, lang, source)`。
3. 保留 `UNIQUE(entity_id, alias, lang)`。
4. 建索引：`entity_alias(alias)`、`entity(canonical_name)`。
5. 同名异人允许共享 `alias + lang`，查询时返回多候选。

**验收标准：**

- [ ] 迁移成功。
- [ ] alias 查询走索引。

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
   - `ux_entity_basic_profile_open_segment`
   - `ux_entity_profile_current`
4. `is_basic=true` 仅允许进入 `entity_basic_profile`。

**验收标准：**

- [ ] 违反约束的写入被 DB 拒绝。
- [ ] 集成测试覆盖 happy path 与约束违例。

---

### Task 1.4：JPA 实体与只读 Repository

1. Repository 仅暴露 `findBy*`、分页、排序等只读能力。
2. 禁止暴露 `save/delete/deleteAll`。
3. 运行时仅依赖单个 `appDataSource`。

**验收标准：**

- [ ] 只读 Repository 接口清晰分层。
- [ ] 单测覆盖基础查询路径。

---

### Task 1.5：`EntityLinkingService`

1. 输入：`surface`、`domainClass?`、`context?: LinkContext`。
2. 候选来源：`entity_alias` + `entity.canonical_name`。
3. 排序：完全匹配 > 前缀 > 模糊。
4. 同名异人场景必须返回全部候选。
5. 返回 `EntityCandidate[]`。

**验收标准：**

- [ ] 单测覆盖完全匹配、多候选、同名异人、空命中。
- [ ] 置信度计算稳定可复现。

---

### Task 1.6：应用层单测覆盖关键规则

1. linking 排序与置信度。
2. `is_basic` 错表路径在应用层的拦截。
3. 时态过滤、空洞段、开放段行为。

**验收标准：**

- [ ] Phase 1 新增代码行覆盖 ≥ 80%。
- [ ] 单测不依赖真实 DB。

---

### Task 1.7：集成测试（只读模型）

1. Flyway 全量迁移成功。
2. 基于 fixture 装载测试数据后，linking 与搜索命中正确。
3. 同名异人共享同一 `alias + lang` 时，返回多个 candidate。
4. 历史版本、开放段、闭合段场景覆盖。

**验收标准：**

- [ ] 全部集成测试在 `mvn verify` 下绿。
- [ ] 重复执行 10 次无 flakiness。

---

## Phase 2：查询接口

### Task 2.1：`POST /api/v1/entities/actions/link`

1. 请求体：`{ surface, domainClass?, context?: LinkContext }`。
2. 响应体：`{ candidates: EntityCandidate[], requestId }`。
3. 同名异人必须返回多候选，而不是单一 best match。

**验收标准：**

- [ ] 端到端集成测试通过。
- [ ] 错误路径返回标准错误码。

---

### Task 2.2：`GET /api/v1/entities/actions/search`

1. 入参：`name`、`domain`、`at`。
2. 流程：调用 `EntityLinkingService` → 读取 `entity_basic_profile` → 返回 `SearchHit[]`。
3. 排序只允许基于 linking 信号与时间有效性。
4. 服务内不做最终判定裁剪。

**验收标准：**

- [ ] 单段、多段、闭合段、开放段场景覆盖。
- [ ] 同名异人场景返回多个 `entity_id`。

---

### Task 2.3：`POST /api/v1/entities/actions/facts`

1. 输入：`{ entityIds: number[], domainClass?: string, at?: timestamp }`。
2. 返回：`EntityFactView[]`。
3. 本接口只返回事实，不返回结论。

**验收标准：**

- [ ] 可批量返回基础事实与可选详情元信息。
- [ ] 缺失分片时返回标准错误或缺失标记。

---

### Task 2.4：详情接口

**端点：**

- `GET /api/v1/entities/{id}/basic-profile?domain={domain}&at={at}`
- `GET /api/v1/entities/{id}/profiles/{entry_code}`

**详细要求：**

1. basic 路径按 `(entity_id, domain, at)` 定位事实段。
2. 非 basic 路径返回 `is_current = true` 的详情分片 URI 与元信息。
3. basic / 非 basic 交叉调用统一返回 400。

**验收标准：**

- [ ] P95 ≤ 50ms（不含 blob 下载）。
- [ ] 路由互不串位。

---

### Task 2.5：历史接口

**端点：**

- `GET /api/v1/entities/{id}/basic-profile/history?domain={domain}`
- `GET /api/v1/entities/{id}/profiles/{entry_code}/history`

**详细要求：**

1. basic 历史返回段列表。
2. 非 basic 历史返回版本列表。
3. 支持分页；不返回完整 blob。

**验收标准：**

- [ ] basic 段按 `valid_from` 降序稳定。
- [ ] 非 basic 版本按 `version` 降序稳定。

---

### Task 2.6：只读契约测试

1. 确认当前 MVP 无业务写接口。
2. 对未开放的 `POST/PUT/PATCH/DELETE` 资源返回 404/405。
3. OpenAPI 文档不暴露写入、审核、发布相关路径。
4. 经 APISIX 访问 `/api/v1/entities/*` 时，请求命中 knowledge 显式路由，而不是 `/api/*`
   通配 backend 路由。
5. knowledge 显式路由的插件配置需与现有受保护 API 一致，至少包含 `jwt-auth` 与
   `proxy-rewrite(headers.set)` 的四个身份头映射。

**验收标准：**

- [ ] 只读契约测试通过。
- [ ] OpenAPI 输出与文档边界一致。
- [ ] APISIX 端到端 smoke test 可验证 knowledge 路由生效。
- [ ] APISIX Admin API 与端到端请求均可验证 `jwt-auth` 和身份头透传配置生效。

---

## Phase 3：观测、压测与部署验证

### Task 3.1：观测指标与日志

1. 输出指标：
   - `knowledge_search_latency_ms`
   - `knowledge_linking_confidence_bucket`
   - `knowledge_query_throughput`
   - `knowledge_profile_read_latency_ms`
2. 结构化日志字段复用 Task 0.10 的 MDC 定义。
3. 暴露 `/actuator/prometheus`。

**验收标准：**

- [ ] 指标按维度可查。
- [ ] 日志可按 `request_id` 串链。

---

### Task 3.2：性能基线

1. `POST /entities/actions/link` P95 ≤ 100ms。
2. `GET /entities/actions/search` P95 ≤ 150ms。
3. `GET /entities/{id}/profiles/{entry_code}` P95 ≤ 50ms。
4. 形成压测报告与瓶颈清单。

**验收标准：**

- [ ] 压测报告产出并纳入 `docs/`。
- [ ] 明确扩容阈值与优化项。

---

### Task 3.3：部署验证

1. 在本地与 dev 环境验证 Native 镜像启动、健康检查、Swagger UI、Prometheus、MinIO 访问。
2. 校验只读配置下服务能稳定启动与处理查询流量。
3. 通过 APISIX 网关验证 `/api/v1/entities/*` northbound 路由可达，未认证请求返回 401。
4. 验证 APISIX 已透传 `X-User-Id`、`X-Username`、`X-Roles`、`X-Tenant-Id`，且服务按此消费。

**验收标准：**

- [ ] dev 环境部署通过。
- [ ] 关键查询接口 smoke test 通过。
- [ ] 网关入口与直连 Service 的返回一致。
- [ ] 网关鉴权失败与成功路径都符合 `jwt-auth` 基线预期。

---

## Phase 4（预留）：写入链路或事实构建能力

当前 MVP 不纳入。如果未来需要在 `koduck-knowledge` 内提供数据写入、审核、发布或事实构建能力，必须单独新增 ADR，不得直接恢复旧治理链任务。

---

## 关键里程碑

- M0（Phase 0 完成）：项目骨架、BlobStore、Swagger UI、Testcontainers、构建链路打通。
- M1（Phase 1 完成）：只读数据模型与 Entity Linking 跑通。
- M2（Phase 2 完成）：查询接口闭环达成。
- M3（Phase 3 完成）：观测、压测、部署验证达成。

---

## 非功能要求

| 项 | 要求 |
| ------ | ------ |
| 服务边界 | 当前 MVP 仅提供读接口，不提供运行时写接口 |
| 数据模型 | 支持多候选、多段历史、详情版本化 |
| 可观测性 | Prometheus + 结构化日志，覆盖 linking / search / profile read |
| 性能基线 | linking P95 ≤ 100ms，search P95 ≤ 150ms，详情读取 P95 ≤ 50ms |
| 可部署性 | Docker 内统一构建，Native Image 默认发布 |
| 一致性 | OpenAPI、设计文档、实施方案都必须体现只读边界 |

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
| ------ | ------ | ------ |
| Entity Linking 规则不足 | 召回率下降 | Phase 1 先规则式实现，后续再评估模型化 |
| 同名异人歧义 | 返回多个候选，调用方需自行判定 | 保留多候选召回，不在服务内提前裁剪 |
| 多段历史约束遗漏 | 查询结果错误 | DB 约束 + 应用层断言 + 集成测试 |
| 数据新鲜度依赖外部装载 | 服务返回旧事实 | 在文档中明确外部装载责任，并做好数据更新时间可观测性 |
| BlobStore 本地 / 生产差异 | 回归 bug | Testcontainers MinIO 覆盖集成测试 |
| 无写接口导致人工修正链路缺失 | 修数需额外流程 | 明确当前范围，仅通过外部流程修正数据 |

---

## 当前状态追踪

| Phase | 状态 | Owner | 备注 |
| ------- | ------ | ------- | ------ |
| 0 | 未开始 | @guhailin | 待启动 |
| 1 | 未开始 | - | 依赖 Phase 0 |
| 2 | 未开始 | - | 依赖 Phase 1 |
| 3 | 未开始 | - | 依赖 Phase 2 |
| 4 | 预留 | - | MVP 之外 |

---

## 任务执行规范

1. 每个 Task 对应独立 PR，PR 标题遵循 Conventional Commits。
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
