# KODUCK-QUANT Agent Guide

> **Language**: 本文档主要使用中文撰写，以与项目其他文档保持一致。
> 
> **Project Status**: Planning / Bootstrap (尚未开始业务代码开发)

## 项目概述

KODUCK-QUANT 是一个面向研究、回测与交易执行的一体化量化软件系统。当前处于项目初始化阶段，重点在于建立规范的开发流程、协作机制与工程基础设施。

### 目标能力（规划中）

- 因子研究与策略原型验证
- 回测引擎与绩效分析
- 风控模块与交易约束
- 交易执行与数据管道集成
- 可复现的实验与版本化管理

### 当前仓库内容

- 流程与贡献规范：`CONTRIBUTING.md`
- GitHub 协作配置：`.github/`
- 记忆与上下文管理目录：`memory/`
- AI Agent 技能目录：`.agents/skills/`

## 技术栈与架构

### 主要技术方向

| 领域 | 技术选择 | 备注 |
|------|----------|------|
| **后端服务** | Java 23+ | 主开发语言，高性能、强类型 |
| API 框架 | Spring Boot 3.x | 企业级微服务框架 |
| 构建工具 | Maven / Gradle | 依赖管理与构建 |
| ORM | Spring Data JPA / MyBatis | 数据库访问层 |
| 数据库 | PostgreSQL (规划) | 主数据库 |
| 缓存 | Redis (规划) | 缓存层 |
| 消息队列 | RabbitMQ / Kafka (规划) | 异步消息处理 |
| **数据分析** | Python 3.12+ | 因子研究、回测、数据科学 |
| 科学计算 | NumPy, Pandas, Polars | 数据处理与分析 |
| 机器学习 | scikit-learn (规划) | 机器学习模型 |
| 可视化 | matplotlib, plotly | 图表与可视化 |

### 代码组织规范

#### Java 后端项目结构（规划中）

```
koduck-backend/
├── pom.xml / build.gradle   # 构建配置
├── src/
│   ├── main/
│   │   ├── java/com/koduck/
│   │   │   ├── KoduckApplication.java    # 启动类
│   │   │   ├── config/                   # 配置类
│   │   │   ├── controller/               # API 控制器层
│   │   │   ├── service/                  # 业务逻辑层
│   │   │   │   ├── impl/                 # 实现类
│   │   │   ├── repository/               # 数据访问层
│   │   │   ├── entity/                   # 实体类 (JPA)
│   │   │   ├── dto/                      # 数据传输对象
│   │   │   ├── vo/                       # 值对象 (View Object)
│   │   │   ├── exception/                # 自定义异常
│   │   │   └── util/                     # 工具类
│   │   └── resources/
│   │       ├── application.yml           # 配置文件
│   │       ├── application-dev.yml
│   │       └── db/migration/             # 数据库迁移脚本
│   └── test/
│       └── java/com/koduck/              # 单元/集成测试
└── docs/
```

#### Python 数据分析项目结构（规划中）

```
koduck-analytics/
├── pyproject.toml          # 项目元数据与依赖
├── src/
│   └── koduck_analytics/
│       ├── __init__.py
│       ├── factor/         # 因子研究与计算
│       ├── backtest/       # 回测引擎
│       ├── data/           # 数据获取与处理
│       ├── model/          # 预测模型
│       └── utils/          # 工具函数
├── notebooks/              # Jupyter 研究笔记
├── tests/
│   └── test_*.py
└── docs/
```

## 分支模型与开发流程

### 分支结构 (main-dev-feature)

严格遵循三分支结构：

| 分支 | 职责 | 流向规则 |
|------|------|----------|
| `main` | 生产稳定分支 | 仅接收来自 `dev` 的合并 |
| `dev` | 日常集成分支 | 接收 `feature/*` 和 `bugfix/*` 的合并 |
| `feature/*` | 功能分支 | 从 `dev` 创建，合并回 `dev` |
| `bugfix/*` | 缺陷修复分支 | 从 `dev` 创建，合并回 `dev` |

### 强制规则

- ❌ 禁止直接向 `main` 提交
- ❌ 禁止将 `feature/*` 或 `bugfix/*` 直接合并到 `main`
- ✅ 每次开发任务对应一个独立分支
- ✅ `feature/*` 与 `bugfix/*` 合并进 `dev` 后自动删除（由 GitHub Actions 执行）

### 标准提交流程

```bash
# 1. 从 dev 创建功能分支
git checkout dev && git pull origin dev
git checkout -b feature/<name>

# 2. 开发与提交
git add .
git commit -m "feat(scope): your change summary"
git push -u origin feature/<name>

# 3. 发起 PR 合并到 dev
```

### Commit Message 规范

遵循 Conventional Commits：

```
<type>(<scope>): <subject>

[type]
  feat: 新功能
  fix: 修复
  docs: 文档
  style: 格式（不影响代码运行的变动）
  refactor: 重构
  perf: 性能优化
  test: 测试
  chore: 构建/工具
  ci: CI/CD 相关
  build: 构建系统
  revert: 回滚

[scope] 可选，如 core, api, ui
[subject] 使用祈使语气，小写开头，结尾不加句号
```

详细模板参考 `.gitmessage.txt`。

## GitHub Actions 工作流

| 工作流 | 触发条件 | 功能 |
|--------|----------|------|
| `Branch Flow Guard` | PR 创建/更新 | 验证 PR 流向：`feature/*\|bugfix/* -> dev` 与 `dev -> main` |
| `Commit Flow Guard` | PR 创建/更新 | 校验 PR 标题与 commit message 是否符合 Conventional Commits |
| `Delete Merged Feature Branch` | PR 合并关闭 | 自动删除已合并的 feature/bugfix 分支 |
| `Create and Push Tag` | 手动触发 | 标准化打 tag 流程（仅允许在 main HEAD） |
| `Release on Tag` | 推送 `v*` tag | 自动创建 GitHub Release |

### 版本标签规范

- 格式：`vX.Y.Z`（如 `v0.1.0`）
- 支持预发布后缀：`v1.2.3-rc.1`
- **仅允许在 `main` 的最新提交（HEAD）上打 tag**

## 代码规范

### Java 后端代码规范

#### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 包 | 小写，反向域名 | `com.koduck.service` |
| 类/接口 | PascalCase | `UserService`, `OrderRepository` |
| 方法/变量 | camelCase | `getUserById`, `maxRetries` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| 枚举 | PascalCase，大写成员 | `Status.ACTIVE` |
| 私有成员 | 无需特殊前缀 | 使用 `this` 区分 |

#### 代码格式化

- **Formatter**: Google Java Format / IntelliJ IDEA 默认
- **Linter**: Checkstyle, SpotBugs
- **行长度**: 100 字符
- **缩进**: 4 空格

#### 代码风格

```java
@Service
public class UserService {
    
    private final UserRepository userRepository;
    
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
    
    /**
     * 根据用户ID获取用户信息。
     *
     * @param userId 用户唯一标识
     * @return 用户对象
     * @throws UserNotFoundException 当用户不存在时抛出
     */
    public User getUserById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
    }
}
```

#### 错误处理

- 使用自定义业务异常继承 `RuntimeException`
- 使用 `@ControllerAdvice` 全局异常处理
- 禁止捕获 `Exception` 或 `Throwable` 而不处理
- 使用 `Optional` 处理可能为空的情况

---

### Python 数据分析代码规范

#### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 模块/包 | 小写，短名，下划线分隔 | `factor_calc`, `data_loader` |
| 类 | PascalCase | `FactorCalculator`, `BacktestEngine` |
| 函数/变量 | snake_case | `calculate_factor`, `close_prices` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_LOOKBACK_DAYS` |
| 私有成员 | 前缀 `_` | `_internal_cache` |

#### 代码格式化

- **Formatter**: `ruff format` (或 `black`)
- **Linter**: `ruff check`
- **行长度**: 88 字符
- **导入排序**: 由 `ruff` 处理

#### 类型注解（推荐）

```python
import numpy as np
import pandas as pd
from typing import Protocol


class FactorProtocol(Protocol):
    """因子计算接口协议。"""
    
    def calculate(self, prices: pd.DataFrame) -> pd.Series:
        ...


def normalize_factor(factor_values: pd.Series) -> pd.Series:
    """对因子值进行标准化处理。
    
    Args:
        factor_values: 原始因子值序列
        
    Returns:
        z-score 标准化后的因子值
    """
    return (factor_values - factor_values.mean()) / factor_values.std()
```

详细 Python 规范参考 `.github/python-standards/pythonic-python-guidelines.md`。

## AI Agent 协作体系

### Agent 配置位置

- `.github/agents/*.agent.md` - 专业领域 Agent 配置
- `.clinerules/*.agent.md` - Cline IDE 使用的 Agent 规则

### 主要 Agent 角色

| Agent | 职责 | 适用场景 |
|-------|------|----------|
| `java-architect` | Java 系统架构设计 | 后端模块架构、技术选型 |
| `java-api-designer` | API 详细设计 | RESTful 接口设计、DTO 定义 |
| `java-coder-specialist` | Java 代码实现 | 后端业务代码编写 |
| `java-code-reviewer` | Java 代码审查 | PR 审查、质量检查 |
| `java-tech-lead` | Java 技术决策 | 后端跨模块决策、最终审批 |
| `python-data-specialist` | Python 数据分析 | 因子计算、回测、数据处理 |
| `python-code-reviewer` | Python 代码审查 | 分析代码 PR 审查 |
| `python-tech-lead` | Python 技术决策 | 数据模块跨模块决策 |
| `java-doc-writer` | Java 文档编写 | API 文档、技术文档 |
| `markdown-writer-specialist` | Markdown 写作 | README、CHANGELOG |
| `cortana` | 通用问题解决 | 日常任务、协调调度 |

### Agent 协作流程

#### Java 后端模块

简单模块：
```
java-architect → java-api-designer → java-coder-specialist → java-code-reviewer → java-tech-lead
```

中等复杂度模块：
```
java-architect (Level 1) → java-tech-lead review
→ java-api-designer (Level 2) → java-tech-lead review
→ java-coder-specialist + java-doc-writer (并行)
→ java-code-reviewer → java-tech-lead final approval
```

#### Python 数据分析模块

```
python-tech-lead → python-data-specialist → python-code-reviewer → python-tech-lead
```

## Skills 技能系统

### 技能目录结构

```
.agents/skills/<skill-name>/
├── SKILL.md              # 技能文档（必须）
├── scripts/              # 实现脚本（可选）
│   └── *.py
└── domains/              # 领域配置（可选）
    └── *.yaml
```

### 现有技能

| 技能 | 描述 | 路径 |
|------|------|------|
| `memory-manager` | 3-tier 分层记忆管理系统 | `.agents/skills/memory-manager/` |
| `stock-price-tracker` | 实时股票价格查询 | `.agents/skills/stock-price-tracker/` |
| `news-search` | 新闻搜索 | `.agents/skills/news-search/` |
| `markdown-formatter` | Markdown 格式化 | `.agents/skills/markdown-formatter/` |
| `md-table-fixer` | Markdown 表格修复 | `.agents/skills/md-table-fixer/` |
| `domain-keyword-detection` | 领域关键词检测 | `.agents/skills/domain-keyword-detection/` |

### Memory Manager 使用

3-tier 记忆系统：

| 层级 | 位置 | 用途 | 保留期 |
|------|------|------|--------|
| L1 | `memory/sessions/YYYY-MM-DD.md` | 原始对话记录 | 30天 |
| L2 | `memory/<theme>/YYYY-MM-DD_HH.md` | 主题化工作记忆 | 90天 |
| L3 | `memory/global.md` | 长期知识 | 永久 |

CLI 工具入口：`./tools/memory-manager`

常用命令：
```bash
# 会话初始化
./tools/memory-manager session-init

# 快速记录
./tools/memory-manager quick-note --content "要点" --auto-theme

# 智能捕获
./tools/memory-manager smart-capture --content "..." --theme auto
```

## 测试规范

### Java 后端测试

#### 测试框架

- **单元测试**: JUnit 5 + Mockito
- **集成测试**: Spring Boot Test + TestContainers
- **目标覆盖率**: 业务逻辑 ≥ 80%
- **测试目录**: `src/test/java/...`

#### 测试示例

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    @DisplayName("当用户存在时返回用户信息")
    void shouldReturnUserWhenFound() {
        User mockUser = new User("1", "Alice");
        when(userRepository.findById("1")).thenReturn(Optional.of(mockUser));

        User result = userService.getUserById("1");

        assertThat(result.getName()).isEqualTo("Alice");
    }

    @Test
    @DisplayName("当用户不存在时抛出异常")
    void shouldThrowExceptionWhenNotFound() {
        when(userRepository.findById("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserById("unknown"))
                .isInstanceOf(UserNotFoundException.class)
                .hasMessageContaining("unknown");
    }
}
```

---

### Python 数据分析测试

#### 测试框架

- **框架**: pytest
- **目标覆盖率**: 核心算法 ≥ 90%
- **Fixture**: 使用 `conftest.py` 共享
- **Mock**: 使用 `unittest.mock`

#### 测试示例

```python
import pytest
import pandas as pd
from koduck_analytics.factor.momentum import calculate_momentum_factor


class TestMomentumFactor:
    """Tests for momentum factor calculation."""

    def test_calculate_returns_series(self, sample_prices: pd.DataFrame) -> None:
        result = calculate_momentum_factor(sample_prices, lookback_days=20)
        assert isinstance(result, pd.Series)
        assert len(result) == len(sample_prices)

    def test_handles_empty_dataframe(self) -> None:
        empty_df = pd.DataFrame()
        with pytest.raises(ValueError, match="Empty price data"):
            calculate_momentum_factor(empty_df, lookback_days=20)
```

## 安全注意事项

### 代码安全

#### Java 后端

- ❌ 禁止硬编码密钥、密码、令牌（使用 Spring Vault / 环境变量）
- ❌ 禁止使用 SQL 拼接（使用 JPA 参数绑定或 PreparedStatement）
- ❌ 禁止在日志中输出敏感信息（密码、token、身份证号等）
- ✅ 所有 API 输入必须使用 Bean Validation (`@Valid`)
- ✅ 使用 Spring Security 进行认证授权
- ✅ 启用 CSRF 保护和 XSS 防护

#### Python 数据分析

- ❌ 禁止使用 `eval()`, `exec()`, `pickle` 处理不可信数据
- ❌ 禁止硬编码密钥、密码、令牌
- ❌ 禁止将生产数据库凭证提交到代码仓库
- ✅ 使用环境变量或配置文件管理敏感信息
- ✅ 数据文件路径使用配置化，避免硬编码

### 数据保护

- 不在日志/输出中暴露密钥、密码、令牌
- 处理用户数据遵循最小必要原则
- 不将用户上下文泄露给不相关的 Agent 或工具

## Issue 与 PR 模板

### Issue 类型

| 类型 | 模板 | 标签 |
|------|------|------|
| Feature Request | `.github/ISSUE_TEMPLATE/feature_request.md` | `enhancement` |
| Bug Report | `.github/ISSUE_TEMPLATE/bug_report.md` | `bug` |
| Question | `.github/ISSUE_TEMPLATE/question.md` | `question` |
| Security | `.github/ISSUE_TEMPLATE/report_security.md` | - |

### PR 规范

- PR 标题必须符合 Conventional Commits 格式
- 所有 commit message 必须通过格式校验
- 变更目标明确且范围聚焦
- 文档同步更新（如流程、约定、设计）

## 快速参考

### 常用命令

```bash
# 创建功能分支
git checkout dev && git pull origin dev
git checkout -b feature/my-feature

# 提交变更
git add .
git commit -m "feat(module): add new feature"
git push -u origin feature/my-feature

# 使用 memory-manager
./tools/memory-manager quick-note --content "学习笔记" --theme coding

# 查看记忆系统状态
./tools/memory-manager list-themes
./tools/memory-manager read-logs --days-back 1
```

### 重要文件索引

| 文件 | 用途 |
|------|------|
| `README.md` | 项目介绍与快速开始 |
| `CONTRIBUTING.md` | 贡献规范与分支模型 |
| `.CHANGELOG.md` | 变更日志 |
| `.gitmessage.txt` | Commit message 模板 |
| `koduck-backend/` | Java 后端服务代码 |
| `koduck-analytics/` | Python 数据分析代码 |
| `.github/java-standards/` | Java 编码规范 |
| `.github/python-standards/` | Python 编码规范 |
| `.github/agents/` | Agent 配置文件 |
| `.agents/skills/` | 技能目录 |

---

**注意**: 本项目处于 Planning / Bootstrap 阶段，业务代码尚未开始开发。当前重点是建立规范的工程基础设施与协作流程。
