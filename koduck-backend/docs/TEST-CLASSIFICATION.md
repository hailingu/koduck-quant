# 测试分类规范

本文档定义后端测试分层、命名约定与执行方式，确保本地与 CI 行为一致。

## 分类原则

1. 单元测试（Unit）
   - 目标：纯业务逻辑验证，不依赖外部基础设施。
   - 路径：`src/test/java/**`（默认），推荐放在 `src/test/java/**/unit/**`。
   - 命名：`*Test.java`。

2. 切片测试（Slice）
   - 目标：针对 Web/JPA 等局部 Spring 切片，验证组件组合行为。
   - 路径：`src/test/java/**/slice/**`。
   - 命名：`*Test.java` 或 `*SliceTest.java`。

3. 集成测试（Integration）
   - 目标：跨模块集成验证，通常依赖 DB/容器/外部组件。
   - 路径：`src/test/java/**/integration/**`，或后缀 `*IntegrationTest.java`。

4. 冒烟测试（Smoke）
   - 目标：关键链路快速可用性验证。
   - 命名：`*SmokeTest.java`。
   - 执行归属：走 Failsafe（与集成测试同阶段）。

## Maven 执行策略

1. `maven-surefire-plugin`（`test` 阶段）
   - 默认执行 Unit + Slice。
   - 默认排除：`integration` 路径、`*IntegrationTest`、`*SmokeTest`。

2. `maven-failsafe-plugin`（`integration-test` / `verify` 阶段）
   - 执行 `integration` 路径测试、`*IntegrationTest`、`*SmokeTest`。

3. 典型命令
   - 本地快速回归：`mvn -f koduck-backend/pom.xml test`
   - 全量含集成：`mvn -f koduck-backend/pom.xml verify`
   - 仅某一测试类：`mvn -f koduck-backend/pom.xml -Dtest=MarketServiceImplTest test`

## 提交约束

1. 新增测试时必须明确分类（路径或命名至少满足一种分类信号）。
2. 禁止将依赖外部环境的测试放入默认单元测试范围。
3. 集成/冒烟测试失败不应通过修改 surefire 排除项来规避，应修复环境或测试本身。
