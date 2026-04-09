# ADR-0002: koduck-user 依赖与基础工程配置

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-09
- **作者**: @hailingu
- **相关**: #675, koduck-user/docs/implementation/koduck-user-service-tasks.md Task 1.2

---

## 背景与问题陈述

koduck-user 作为独立服务需要配置 Maven 依赖与基础工程配置。关键决策点包括：

1. 是否引入 `koduck-bom` 进行统一版本管理？
2. 是否依赖 `koduck-common` 共享库？
3. 注解处理器（Lombok、MapStruct）如何配置？
4. 测试依赖的范围与选择？

### 上下文

- koduck-user 当前处于骨架阶段（Phase 1），尚未有实际业务代码
- 仓库中存在 `koduck-bom` 和 `koduck-common`，服务于 `koduck-backend` 多模块工程
- Task 1.2 明确要求：当前阶段保持依赖最小化，不强依赖 `koduck-common` 与 `koduck-bom`

---

## 决策驱动因素

1. **独立性**: 作为顶级独立服务，构建不应依赖仓库内其他模块
2. **最小化**: 骨架阶段只引入必要的运行时和编译时依赖
3. **版本一致性**: Spring Boot 版本与 `koduck-backend` 保持对齐（3.4.2）
4. **可演进**: 后续按需引入共享依赖，当前不预引入

---

## 考虑的选项

### 选项 1: 引入 koduck-bom + koduck-common

**描述**: 通过 `koduck-bom` 管理版本，依赖 `koduck-common` 复用工具类

```
dependencyManagement:
  koduck-bom (pom import)
dependencies:
  koduck-common
```

**优点**:
- 版本统一管理，减少版本冲突
- 可复用 `koduck-common` 中的工具类、异常定义等

**缺点**:
- 构建 `koduck-user` 需要先构建 `koduck-common`
- 骨架阶段无实际复用场景，引入属于过早耦合
- CI/CD 需要协调两个模块的构建顺序

### 选项 2: 完全独立，不引入 koduck-bom/koduck-common（选定）

**描述**: 版本管理由 `spring-boot-starter-parent` 和显式版本属性承担，不依赖仓库内模块

```
parent: spring-boot-starter-parent:3.4.2
显式声明: lombok.version, mapstruct.version
```

**优点**:
- 构建链路简单，无需先构建其他模块
- 依赖列表清晰，可独立审计
- 与 ADR-0001 "独立顶级项目" 的定位一致

**缺点**:
- 版本需手动与 `koduck-backend` 对齐（升级时人工检查）
- 后续引入共享代码时需额外引入依赖

---

## 决策结果

**选定的方案**: 选项 2 - 完全独立

### 依赖清单

| 依赖 | 用途 | Scope |
|------|------|-------|
| `spring-boot-starter-web` | HTTP API | compile |
| `spring-boot-starter-validation` | Bean Validation | compile |
| `spring-boot-starter-data-jpa` | ORM 与数据访问 | compile |
| `spring-boot-starter-actuator` | 健康检查与监控 | compile |
| `flyway-core` + `flyway-database-postgresql` | 数据库迁移 | compile |
| `postgresql` | PostgreSQL 驱动 | runtime |
| `lombok` | 代码简化 | compile (optional) |
| `mapstruct` | DTO 映射 | compile |
| `spring-boot-starter-test` | 测试（JUnit5、Mockito、AssertJ） | test |

### 版本管理策略

- **Spring Boot 生态**: 由 `spring-boot-starter-parent:3.4.2` 统一管理
- **Lombok**: 显式声明 `${lombok.version}=1.18.36`
- **MapStruct**: 显式声明 `${mapstruct.version}=1.6.3`
- **Java**: 23（与 `koduck-backend` 一致）

### 注解处理器配置

Lombok + MapStruct 联合使用需注意处理顺序：
- `lombok` 处理器在前
- `mapstruct-processor` 在后
- `lombok-mapstruct-binding:0.2.0` 确保两者协作

### 不引入的依赖

| 依赖 | 不引入原因 | 后续引入时机 |
|------|-----------|-------------|
| `koduck-bom` | 当前无共享版本管理需求 | 多服务版本统一时 |
| `koduck-common` | 当前无复用场景 | 需要共享工具类/异常时 |

**积极后果**:

- `mvn -f koduck-user/pom.xml compile` 无需构建其他模块
- 依赖变更影响面可控

**消极后果**:

- MapStruct、Lombok 版本需手动维护
- 与 koduck-backend 的版本同步需人工关注

**缓解措施**:

- 在 CI 中定期检查版本一致性
- 后续通过引入 `koduck-bom` 进行版本统一

---

## 实施细节

### 变更内容

1. 移除 `dependencyManagement` 中的 `koduck-bom` 引用
2. 移除 `dependencies` 中的 `koduck-common`
3. 为 `mapstruct` 显式指定 `${mapstruct.version}`
4. 保留 `lombok.version` 和 `mapstruct.version` 属性声明
5. 移除 `koduck.version` 属性（当前无引用）

### 影响范围

- 仅修改 `koduck-user/pom.xml`
- 不影响 `koduck-backend` 及其他模块
- 编译行为不变（已验证通过）

---

## 相关文档

- [ADR-0001: koduck-user 模块骨架设计](ADR-0001-module-skeleton.md)
- [koduck-auth-user-service-design.md](../design/koduck-auth-user-service-design.md) 7.1 节
- [koduck-user-service-tasks.md](../implementation/koduck-user-service-tasks.md) Task 1.2

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-09 | 初始版本 | @hailingu |
