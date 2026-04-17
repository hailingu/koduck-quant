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
查询时完成实体标准化（Entity Linking），并以资源化 API 返回基础事实、详情分片与历史信息。

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
- 技术背景：仓库现有服务主要使用 Java 与 Rust；本地开发环境 `koduck-dev` 已提供 MinIO（S3 兼容）。

---

## 决策驱动因素

1. **边界清晰优先**：当前阶段先把事实查询服务做好，不把事实构建与治理链混入。
2. **查询稳定优先**：Entity Linking、多候选召回、详情读取、历史读取要先形成闭环。
3. **与仓库技术栈协同**：降低引入新栈的学习与运维成本。
4. **本地/生产同构**：MinIO 本地，S3 生产，协议一致。
5. **职责清晰**：基础事实入口与详情分片职责分离，不重复。
6. **保留扩展性**：当前只读，但 schema 与 API 设计不阻断未来引入独立写入链路。
7. **网关一致性**：northbound HTTP 入口应复用仓库现有 APISIX 注册、鉴权与身份头透传基线。

---

## 考虑的选项

### D1. 技术栈

- **选项 A**：Java (Spring Boot) + 独立 Postgres。
- **选项 B**：Rust + 独立 Postgres。
- **选项 C**：Python + 独立 Postgres。

### D2. Blob 存储

- **选项 A**：直接依赖 AWS S3。
- **选项 B**：定义 `BlobStore` 抽象，默认 S3 协议；本地接 MinIO，生产接真实 S3。

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

---

## 决策结果

### 选定的方案

| 决策 | 选定选项 |
| --- | --- |
| D1 技术栈 | **A：Java (Spring Boot) + 独立 Postgres** |
| D2 Blob 存储 | **B：`BlobStore` 抽象，默认 S3 协议** |
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

### 理由

1. Java 与仓库主栈一致，团队熟悉，适合当前查询型服务。
2. `BlobStore` 抽象保证本地/生产协议一致。
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

### 积极后果

- 服务职责更单一，MVP 范围更可控。
- 数据模型与查询接口可以优先稳定下来。
- 不需要在当前阶段设计候选区、审核流、发布流。
- 同名异人场景可直接通过多候选返回支持外部判定。
- 本地与生产对象存储协议一致，便于回归测试。

### 消极后果

- 数据新鲜度依赖外部装载流程，而非服务内闭环。
- 需要额外约定外部数据构建与灌库方式。
- 无物理 FK 时，脏数据不会被 DB 自动完全拦截。
- 只读服务无法直接承接人工修正，需要外部流程配合。

### 缓解措施

- 用文档明确写清楚“服务外部负责装载”的边界。
- 通过 Testcontainers 构建稳定的只读查询测试夹具。
- 通过应用层查询容错与集成测试覆盖别名冲突、缺失分片、时态空洞等场景。
- 保留 schema 的演进空间，未来若要新增写入服务，单独 ADR 立项。
- 通过只读 API 契约与日志指标，先把读取链路打磨稳定。

---

## 实施细节

### 总体架构

- 服务：`koduck-knowledge`（Spring Boot 3.x，独立顶层项目）
- 存储：独立 PostgreSQL 库 `koduck_knowledge` + S3/MinIO
- API：REST + OpenAPI 3.x / Swagger UI
- 网关：通过现有 APISIX `apisix-route-init` Job 暴露 `/api/v1/entities/*` 显式路由，复用
  `jwt-auth + proxy-rewrite(headers.set)` 的受保护 API 基线
- 日志：slf4j + log4j2 + JSON 格式
- 构建：Docker 内统一构建，Native Image 默认发布
- 边界：运行时仅提供读取接口，不提供写入、审核、发布接口

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

#### `profile_entry_dict`

```sql
profile_entry_id  INT PRIMARY KEY
code              TEXT UNIQUE NOT NULL
is_basic          BOOLEAN NOT NULL DEFAULT false
```

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

- 同一 `(entity_id, domain_class)` 最多存在一条 `valid_to IS NULL`。
- 新段 `valid_from` 不能早于上一段 `valid_to`。
- `basic_profile_entry_id` 必须对应 `is_basic = true`。

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
- 禁止 `is_basic = true` 的 entry 写入 `entity_profile`。

### 查询接口范围

- `POST /api/v1/entities/actions/link`
- `GET /api/v1/entities/actions/search`
- `POST /api/v1/entities/actions/facts`
- `GET /api/v1/entities/{id}/basic-profile`
- `GET /api/v1/entities/{id}/profiles/{entry_code}`
- `GET /api/v1/entities/{id}/basic-profile/history`
- `GET /api/v1/entities/{id}/profiles/{entry_code}/history`

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

- [ ] Phase 0：创建 `koduck-knowledge` 模块骨架、S3/MinIO 适配、Testcontainers、日志与构建链路。
- [ ] Phase 1：落地只读事实模型与 Entity Linking 最小内核。
- [ ] Phase 2：实现 `link/search/facts/detail/history` 查询接口。
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
