# ADR-1002: koduck-user 模块骨架设计

## 元数据

- **状态**: 已接受
- **日期**: 2026-04-08
- **作者**: @hailingu
- **相关**: #671, #673, docs/design/koduck-auth-user-service-design.md

---

## 背景与问题陈述

koduck-user 需要从 koduck-auth 中独立出来，作为专门负责用户信息管理、角色权限管理的独立服务。我们需要确定 koduck-user 模块的目录结构、包组织方式以及与现有 Maven 多模块工程的关系。

### 上下文

- **业务背景**: 用户管理（CRUD、角色权限）与认证（登录、JWT、密码重置）职责需要解耦，koduck-user 专注用户数据，koduck-auth 专注认证流程
- **技术背景**: 仓库中存在独立服务（Rust 版 koduck-auth）和 Java 多模块工程（koduck-backend）。koduck-user 作为 Java 独立服务，应与 Rust koduck-auth 同级
- **设计文档**: 遵循 `koduck-auth-user-service-design.md` 2.2 节定义的代码结构

---

## 决策驱动因素

1. **独立性**: koduck-user 作为独立服务，应与 koduck-auth（Rust）同级，不嵌套在 koduck-backend 内
2. **版本对齐**: 通过 import `koduck-bom` 保持依赖版本与 koduck-backend 一致
3. **包结构清晰**: 按领域（user）组织 entity/repository/dto/controller/service
4. **独立构建**: 可独立编译、打包、部署，无需构建整个 koduck-backend

---

## 考虑的选项

### 选项 1: 嵌套在 koduck-backend 内（单层模块）

**描述**: `koduck-user` 作为 koduck-backend 的子模块，parent 为 `koduck-backend-parent`

```
koduck-backend/koduck-user/
```

**优点**:
- Maven 聚合构建方便
- 直接复用 parent 的 pluginManagement 和 checkstyle 配置

**缺点**:
- 不是独立服务，与 Rust koduck-auth 的定位不一致
- 删除 koduck-backend/koduck-auth（Java）时，结构不对齐
- 构建 koduck-user 需要拉取整个 koduck-backend

### 选项 2: 独立顶级项目（选定）

**描述**: koduck-user 作为顶级目录，与 koduck-auth（Rust）同级，parent 直接为 `spring-boot-starter-parent`

```
koduck-user/              # 独立服务
koduck-auth/              # Rust 独立服务
koduck-backend/           # Java 多模块工程
```

**优点**:
- 与 koduck-auth（Rust）定位一致，都是顶级独立服务
- 独立构建、独立部署、独立 CI/CD
- 通过 import koduck-bom 保持版本对齐

**缺点**:
- 需要自行配置编译器插件和注解处理器
- 不参与 koduck-backend 的聚合构建

### 选项 3: api/impl 分层模块

**描述**: 拆分为 `koduck-user-api`（接口/DTO）和 `koduck-user-impl`（实现）

**优点**:
- API 契约独立发布

**缺点**:
- 当前通过内部 HTTP 通信，不需要 Java API 依赖
- 过度设计

---

## 决策结果

**选定的方案**: 选项 2 - 独立顶级项目

**理由**:

1. **服务定位对齐**: 与 Rust koduck-auth 同级，体现独立服务架构
2. **独立构建**: 无需拉取整个 koduck-backend 即可编译
3. **版本对齐**: 通过 import koduck-bom 保持与 koduck-backend 的依赖版本一致
4. **koduck-common 复用**: 通过 koduck-bom 引入 koduck-common，构建前先 install koduck-common

**积极后果**:

- 独立服务，可独立 CI/CD 和部署
- 与仓库中其他独立服务（koduck-auth）结构一致

**消极后果**:
- 需要自行维护编译器插件配置
- 构建前需要先 `mvn install` koduck-common（或通过 CI 缓存）

**缓解措施**:
- 编译器配置与 koduck-backend-parent 保持一致
- CI 中先构建 koduck-common 再构建 koduck-user

---

## 实施细节

### 模块结构

```
koduck-user/
  pom.xml                    # parent: spring-boot-starter-parent
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

- parent: `spring-boot-starter-parent:3.4.2`
- import: `koduck-bom` 用于版本对齐
- artifactId: `koduck-user`
- packaging: `jar`
- 依赖: Spring Boot Web, Validation, Data JPA, Flyway, Actuator, PostgreSQL, koduck-common

### 影响范围

- 新增顶级目录: `koduck-user/`
- 不修改: `koduck-backend/pom.xml`（不注册为子模块）
- 无影响: 现有 koduck-backend 内的模块不受影响

### 迁移策略

从 koduck-backend/koduck-user 移到顶级目录，更新 pom.xml parent 为 spring-boot-starter-parent。

---

## 相关文档

- [koduck-auth-user-service-design.md](../../docs/design/koduck-auth-user-service-design.md)
- [koduck-user-service-tasks.md](../../docs/implementation/koduck-user-service-tasks.md)
- [koduck-user-jwt-design.md](../../docs/design/koduck-user-jwt-design.md)

---

## 备注

- koduck-user 服务端口: 8082（设计文档 2.1 节）
- 包命名统一为 `com.koduck.*`，领域后缀为 `user`
- 启动类: `com.koduck.KoduckUserApplication`
- 构建顺序: 先 `mvn install` koduck-common，再构建 koduck-user

---

## 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-04-08 | 初始版本（嵌套在 koduck-backend 内） | @hailingu |
| 2026-04-09 | 变更为顶级独立服务，更新决策和 Maven 配置 | @hailingu |
