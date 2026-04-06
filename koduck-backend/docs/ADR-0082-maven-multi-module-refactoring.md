# ADR-0082: Maven 多模块重构

- Status: Accepted
- Date: 2026-04-04
- Issue: #458

## Context

根据 `ARCHITECTURE-EVALUATION.md` 评估，当前 `koduck-backend` 存在以下问题：

1. **单一 Maven 模块**：所有代码集中在 `koduck-backend` 单一模块中，`pom.xml` 超过 600 行
2. **缺乏物理隔离**：领域边界（market/portfolio/community 等）仅通过包名区分，无编译期强制约束
3. **依赖管理复杂**：所有依赖在一个 pom.xml 中管理，新增/升级依赖影响整个项目
4. **无法独立演进**：各领域无法独立版本管理、独立发布

### 当前模块规模（Phase 2 基线）

| 模块 | 文件数 | 职责 |
|------|--------|------|
| controller | 22 | API 端点 |
| service | 84 | 业务逻辑 |
| repository | 37 | 数据访问 |
| entity | 36 | 领域模型 |
| dto | 100 | 数据传输对象 |
| config | 10+ | Spring 配置 |

## Decision

### 1. 多模块拆分方案

将单一模块拆分为以下 Maven 模块：

```
koduck-backend/
├── pom.xml                          # 父 POM，依赖管理
├── koduck-bom/                      # BOM 模块，统一版本
│   └── pom.xml
├── koduck-common/                   # 共享基础设施
│   ├── koduck-common-domain/        # 共享实体、DTO、异常
│   ├── koduck-common-util/          # 工具类
│   └── koduck-common-config/        # 通用配置
├── koduck-market/                   # 行情数据模块
│   └── koduck-market-service/       # 行情服务实现
├── koduck-portfolio/                # 投资组合模块
│   └── koduck-portfolio-service/
├── koduck-community/                # 社区信号模块
│   └── koduck-community-service/
├── koduck-backtest/                 # 回测引擎模块
│   └── koduck-backtest-service/
├── koduck-identity/                 # 身份认证模块
│   └── koduck-identity-service/
└── koduck-bootstrap/                # 启动模块
    └── pom.xml                      # 组装所有模块
```

### 2. 模块依赖规则

```
koduck-bootstrap
    ├── koduck-market-service
    ├── koduck-portfolio-service
    ├── koduck-community-service
    ├── koduck-backtest-service
    ├── koduck-identity-service
    └── koduck-common-* (transitive)

koduck-*-service → koduck-common-*
```

### 3. BOM 版本管理

创建 `koduck-bom` 模块统一管理依赖版本：

- Spring Boot 版本: 3.4.2
- Java 版本: 23
- 各内部模块版本: ${project.version}

### 4. 包结构调整

各业务模块使用独立的 base package：

- `com.koduck.market.*` → `koduck-market-service`
- `com.koduck.portfolio.*` → `koduck-portfolio-service`
- `com.koduck.community.*` → `koduck-community-service`
- `com.koduck.backtest.*` → `koduck-backtest-service`
- `com.koduck.identity.*` → `koduck-identity-service`
- `com.koduck.common.*` → `koduck-common-*`

## Consequences

### 正向影响

- **物理隔离**：模块间依赖通过 Maven 强制约束，无法循环依赖
- **独立演进**：各模块可独立版本发布，按需升级
- **并行开发**：团队可在不同模块上并行工作，减少冲突
- **编译加速**：修改单个模块无需全量编译
- **测试聚焦**：模块单元测试更加聚焦，执行更快
- **清晰的架构边界**：物理模块与 DDD bounded context 对齐

### 代价与风险

- **重构工作量大**：需要移动大量文件、调整 import、修改配置
- **过渡期复杂性**：需要维护新旧结构的兼容性
- **CI/CD 调整**：构建流程需要适配多模块结构

### 兼容性影响

- **API 兼容**：HTTP API 路径、请求/响应格式保持不变
- **数据库兼容**：数据库 schema 无变化
- **配置兼容**：application.yml 结构保持兼容，路径调整
- **部署兼容**：最终产出仍为单个可执行 JAR（通过 bootstrap 模块）

## Alternatives Considered

1. **保持单一模块，仅优化包结构**
   - 拒绝：无法解决物理隔离和独立演进问题
   - 当前方案：通过 Maven 模块建立强制边界

2. **直接拆分为独立微服务**
   - 拒绝：改造成本过高，需要引入服务发现、RPC 等基础设施
   - 当前方案：先模块化，为未来微服务拆分奠定基础

3. **使用 Gradle 替代 Maven**
   - 拒绝：团队已有 Maven 经验，且 Spring Boot 官方优先支持 Maven
   - 当前方案：继续使用 Maven，通过 BOM 管理版本

## Implementation Phases

### Phase 1: 基础设施搭建
- 创建父 POM 和 BOM 模块
- 创建 koduck-common 各子模块
- 建立模块间依赖关系

### Phase 2: 业务模块迁移（按优先级）
1. koduck-identity（认证基础）
2. koduck-market（核心行情）
3. koduck-portfolio
4. koduck-community
5. koduck-backtest

### Phase 3: 启动模块整合
- 创建 koduck-bootstrap
- 整合所有模块
- 验证端到端功能

### Phase 4: 清理与文档
- 删除旧结构
- 更新文档
- 更新 CI/CD 流程

## Verification

- [x] `mvn -f koduck-backend/pom.xml clean compile` 编译通过
- [x] `./koduck-backend/scripts/quality-check.sh` 全绿
- [x] `mvn -f koduck-backend/pom.xml checkstyle:check` 无异常
- [x] 各模块依赖关系正确（无循环依赖）
- [x] Bootstrap 模块可正常启动
