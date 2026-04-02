# ADR-0029: 接入 Alibaba Checkstyle 并统一测试分类规范

- Status: Accepted
- Date: 2026-04-02
- Issue: #346

## Context

仓库已提供标准规则文件 `.github/java-standards/checkstyle-alibaba.xml`，但未在后端构建流程中有效执行，导致“有标准、无落地”。

同时，测试执行存在分类约定分散的问题：单元、切片、集成、冒烟测试的边界与执行入口未形成统一文档，容易出现环境依赖测试误入默认测试阶段。

## Decision

1. 在 `koduck-backend/pom.xml` 接入 `maven-checkstyle-plugin`：
   - 规则文件：`${project.basedir}/../.github/java-standards/checkstyle-alibaba.xml`
   - 绑定到 `validate` 阶段，纳入默认构建流程；
   - 覆盖主代码与测试代码（`includeTestSourceDirectory=true`）。
2. 采用“分阶段收敛”策略：
   - 当前阻断 `error` 级别违规；
   - 保留 `warning` 可见性用于持续治理。
3. 明确测试分类与执行边界：
   - Surefire：Unit + Slice；
   - Failsafe：Integration + Smoke；
   - 在 Failsafe includes 中显式纳入 `*SmokeTest.java`。
4. 新增测试分类规范文档并加入 docs 索引。

## Consequences

正向影响：

- Checkstyle 规则从“文件存在”升级为“构建可执行”；
- 风格治理有统一入口，降低团队代码风格漂移；
- 测试分层更加清晰，减少默认测试阶段受环境依赖干扰。

代价：

- 构建时间略有增加；
- 需要持续处理 warning 存量并规划后续收紧策略。

## Alternatives Considered

1. 仅在 CI 脚本中手工调用 Checkstyle，不写入 Maven 生命周期
   - 拒绝：与本地构建不一致，维护成本高。

2. 直接阻断 warning
   - 暂不采用：当前存量较大，先保证规则落地与可观测，再逐步收紧。

## Verification

- `mvn -f koduck-backend/pom.xml -DskipTests checkstyle:check` 可执行；
- `mvn -f koduck-backend/pom.xml test` 与 `verify` 的测试分层行为符合文档；
- 文档索引已加入 ADR 与测试分类规范。
