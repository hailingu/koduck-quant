# ADR-1002: koduck-user 模块骨架设计

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-08
- **作者**: @hailingu
- **相关**: #671, docs/design/koduck-auth-user-service-design.md

---

## 背景与问题陈述

koduck-user 需要从 koduck-auth 中独立出来，作为专门负责用户信息管理、角色权限管理的独立服务。我们需要确定 koduck-user 模块的目录结构、包组织方式以及与现有 Maven 多模块工程的集成方式。

### 上下文

- **业务背景**: 用户管理（CRUD、角色权限）与认证（登录、JWT、密码重置）职责需要解耦，koduck-user 专注用户数据，koduck-auth 专注认证流程
- **技术背景**: 现有工程为 Maven 多模块结构（parent: `koduck-backend-parent`），已有 koduck-auth、koduck-market 等模块。包命名统一为 `com.koduck.*`，子模块通过领域后缀区分（如 `entity/auth`、`dto/auth`）
- **设计文档**: 遵循 `koduck-auth-user-service-design.md` 2.2 节定义的代码结构

---

## 决策驱动因素

1. **一致性**: 与现有模块（koduck-auth 等）的目录结构、命名风格保持一致
2. **Maven 集成**: 必须被父工程识别并参与构建，复用 BOM、插件、质量门禁配置
3. **包结构清晰**: 按领域（user）组织 entity/repository/dto/controller/service
4. **独立部署**: 模块具备独立的 Spring Boot 启动类和 application.yml

---

## 考虑的选项

### 选项 1: 单层模块（与 koduck-auth 一致）

**描述**: `koduck-user` 作为单个 jar 模块，直接放在 `koduck-backend/` 下，包结构用 `user` 子包区分领域

```
koduck-backend/koduck-user/
  src/main/java/com/koduck/
    controller/user/
    service/
    entity/user/
    repository/user/
    dto/user/
  src/main/resources/
    application.yml
    db/migration/
  src/test/java/com/koduck/
```

**优点**:
- 与 koduck-auth 结构完全一致，团队零学习成本
- 模块简洁，无 api/impl 拆分开销
- Maven 配置简单，一个 pom.xml 搞定

**缺点**:
- 所有代码在同一个 jar 中，无法独立发布 API 契约
- 如果未来需要 api/impl 拆分，需重构

### 选项 2: api/impl 分层模块（与 koduck-market 一致）

**描述**: 拆分为 `koduck-user-api`（接口/DTO）和 `koduck-user-impl`（实现），方便其他服务仅依赖 API

```
koduck-backend/koduck-user/
  koduck-user-api/    # 接口、DTO
  koduck-user-impl/   # 实现、Entity、Repository
  pom.xml             # 聚合 pom
```

**优点**:
- API 契约独立发布，服务间依赖更精确
- 适合复杂领域，接口与实现解耦

**缺点**:
- 当前 koduck-user 与 koduck-auth 通过内部 HTTP 通信，不依赖 Java API
- 增加模块数量和 pom.xml 维护成本
- 过度设计，当前阶段不需要

### 选项 3: 独立顶层项目

**描述**: koduck-user 作为独立 Git 仓库，完全脱离 koduck-backend

**优点**:
- 完全独立部署和版本管理

**缺点**:
- 与现有 Maven 聚合结构不一致
- 共享 koduck-common/koduck-infrastructure 需要额外配置
- CI/CD 流程需要大幅调整

---

## 决策结果

**选定的方案**: 选项 1 - 单层模块（与 koduck-auth 一致）

**理由**:

1. **一致性优先**: koduck-user 当前复杂度与 koduck-auth 相当，单层模块足够
2. **通信方式**: koduck-user 与 koduck-auth 通过内部 HTTP API 通信，不需要 Java API 依赖
3. **最小变更**: 遵循现有模式，降低团队认知负担和构建配置复杂度
4. **可演进**: 未来如果需要 api/impl 拆分，可以按 koduck-market 的模式重构

**积极后果**:

- 团队无需学习新的模块组织方式
- 构建配置与质量门禁可直接复用
- 模块结构简洁清晰

**消极后果**:

- 未来如需拆分 API 契约需要重构
- 所有代码耦合在同一个 jar 中

**缓解措施**:

- 包结构已按领域分层（controller/service/entity/repository/dto），拆分成本低
- 如果出现跨服务 Java API 依赖需求，再考虑拆分

---

## 实施细节

### 模块结构

```
koduck-backend/koduck-user/
  pom.xml
  docs/
    1002-koduck-user-module-skeleton.md
  src/
    main/
      java/com/koduck/
        KoduckUserApplication.java
        controller/user/
        service/
        service/impl/
        entity/user/
        repository/user/
        dto/user/
        config/
      resources/
        application.yml
        db/migration/
    test/
      java/com/koduck/
```

### Maven 配置要点

- parent: `koduck-backend-parent`
- artifactId: `koduck-user`
- packaging: `jar`
- 依赖: Spring Boot Web, Validation, Data JPA, Flyway, Actuator, PostgreSQL
- 在父 pom.xml 的 `<modules>` 中注册

### 影响范围

- 新增模块: `koduck-backend/koduck-user`
- 修改文件: `koduck-backend/pom.xml`（添加 module 和 dependencyManagement）
- 无影响: 现有 koduck-auth 及其他模块不受影响

### 迁移策略

不涉及迁移。koduck-user 为全新模块，不影响现有服务。

---

## 相关文档

- [koduck-auth-user-service-design.md](../../../docs/design/koduck-auth-user-service-design.md)
- [koduck-user-service-tasks.md](../../../docs/implementation/koduck-user-service-tasks.md)
- [koduck-user-jwt-design.md](../../../docs/design/koduck-user-jwt-design.md)

---

## 备注

- koduck-user 服务端口: 8082（设计文档 2.1 节）
- 包命名统一为 `com.koduck.*`，领域后缀为 `user`
- 启动类: `com.koduck.KoduckUserApplication`

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-08 | 初始版本 | @hailingu |
