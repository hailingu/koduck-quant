# 质量趋势看板

> **版本**: v1.0  
> **更新日期**: 2026-04-01  
> **维护者**: DevOps Team

---

## 📋 看板概述

质量趋势看板用于持续观察 koduck-quant 项目的质量指标，包括测试覆盖率、静态分析结果和代码质量趋势。

### 核心指标

| 指标类别 | 指标名称 | 目标值 | 说明 |
|----------|----------|--------|------|
| **测试** | 测试通过率 | 100% | 所有测试必须通过 |
| **覆盖率** | 行覆盖率 | ≥60% | JaCoCo 行覆盖率 |
| **覆盖率** | 分支覆盖率 | ≥40% | JaCoCo 分支覆盖率 |
| **静态分析** | PMD 违规 | 0 | 代码规范违规数 |
| **静态分析** | SpotBugs 警告 | 0 | 潜在 Bug 警告数 |

---

## 🔗 访问地址

### 质量数据文件

- **最新数据**: [quality-metrics-2026-04-01.json](./quality-trend/quality-metrics-2026-04-01.json)
- **历史趋势目录**: [quality-trend/](./quality-trend/)
- **CI 报告**: GitHub Actions → [CI Quality Gate](https://github.com/hailingu/koduck-quant/actions/workflows/ci-quality-gate.yml)

### 本地查看

```bash
# 查看最新质量指标
cat docs/phase3/quality-trend/quality-metrics-$(date +%Y-%m-%d).json | jq

# 查看历史趋势
ls -lt docs/phase3/quality-trend/
```

---

## 📊 指标定义与采集方式

### 测试指标

| 指标 | 来源 | 采集命令 |
|------|------|----------|
| 测试总数 | Maven Surefire | `mvn test` |
| 通过/失败数 | Surefire XML | `target/surefire-reports/*.xml` |
| 执行时间 | Surefire 报告 | 报告中的 `time` 属性 |

### 覆盖率指标

| 指标 | 来源 | 阈值 |
|------|------|------|
| 行覆盖率 (Line%) | JaCoCo | ≥60% |
| 分支覆盖率 (Branch%) | JaCoCo | ≥40% |
| 指令覆盖率 (Instruction%) | JaCoCo | - |

**采集方式**:
```bash
cd koduck-backend
mvn clean test jacoco:report
# 报告位置: target/site/jacoco/index.html
```

### 静态分析指标

| 工具 | 指标 | 目标 | 配置 |
|------|------|------|------|
| PMD | 违规数 | 0 | `config/pmd/ruleset-phase2.xml` |
| SpotBugs | 警告数 | 0 | `spotbugs-exclude.xml` |

**采集方式**:
```bash
# PMD
mvn pmd:pmd
# 报告位置: target/pmd.xml

# SpotBugs
mvn spotbugs:spotbugs
# 报告位置: target/spotbugsXml.xml
```

---

## 📈 历史趋势

### 最近 4 周数据摘要

| 日期 | 测试数 | 行覆盖率 | 分支覆盖率 | PMD | SpotBugs |
|------|--------|----------|------------|-----|----------|
| 2026-03-04 | 116 | 38.2% | 27.1% | 0 | 0 |
| 2026-03-11 | 116 | 39.1% | 28.3% | 0 | 0 |
| 2026-03-18 | 116 | 39.8% | 29.0% | 0 | 0 |
| 2026-03-25 | 116 | 40.2% | 29.4% | 0 | 0 |
| **2026-04-01** | **116** | **40.6%** | **29.6%** | **0** | **0** |

### 趋势解读

- ✅ **覆盖率稳步提升**: 行覆盖率从 38.2% 提升至 40.6% (+2.4%)
- ✅ **静态分析零违规**: PMD 和 SpotBugs 保持零警告
- ✅ **测试全部通过**: 116 个测试持续通过

---

## 🚀 使用指南

### 1. 手动采集指标

```bash
# 运行采集脚本（项目根目录）
./scripts/quality-metrics-collector.sh

# 指定日期采集
./scripts/quality-metrics-collector.sh -d 2026-03-25

# 模拟运行（不执行测试）
./scripts/quality-metrics-collector.sh --dry-run

# 跳过测试，仅解析现有报告
./scripts/quality-metrics-collector.sh --skip-tests
```

### 2. 查看趋势

```bash
# 显示最近4周趋势
./scripts/quality-metrics-collector.sh --skip-tests 2>/dev/null | grep -A 20 "质量指标趋势"
```

### 3. 解析 JSON 数据

```bash
# 使用 jq 查询
jq '.metrics.coverage.line_percent' docs/phase3/quality-trend/quality-metrics-2026-04-01.json

# 查询测试通过率
jq '.metrics.tests | {total, passed, pass_rate}' docs/phase3/quality-trend/quality-metrics-2026-04-01.json
```

---

## 📝 周报复用示例

### 周报引用模板

在周报中引用质量看板数据：

```markdown
## 本周质量指标

数据来源: [质量看板](../docs/phase3/quality-dashboard.md)

| 指标 | 本周值 | 上周值 | 变化 |
|------|--------|--------|------|
| 行覆盖率 | 40.6% | 40.2% | ↗️ +0.4% |
| 分支覆盖率 | 29.6% | 29.4% | ↗️ +0.2% |
| 测试通过 | 116/116 | 116/116 | → 持平 |
| PMD 违规 | 0 | 0 | → 持平 |

### 质量趋势
- 覆盖率持续提升，已接近 Phase 3 目标 (60% 行覆盖)
- 静态分析保持零违规
- 所有测试稳定通过
```

### 自动化获取周报数据

```bash
#!/bin/bash
# 获取周报所需的质量数据

LATEST=$(ls -t docs/phase3/quality-trend/quality-metrics-*.json | head -1)

echo "## 本周质量指标"
echo ""
echo "| 指标 | 数值 |"
echo "|------|------|"
echo "| 行覆盖率 | $(jq -r '.metrics.coverage.line_percent' $LATEST)% |"
echo "| 分支覆盖率 | $(jq -r '.metrics.coverage.branch_percent' $LATEST)% |"
echo "| 测试通过 | $(jq -r '.metrics.tests.passed' $LATEST)/$(jq -r '.metrics.tests.total' $LATEST) |"
echo "| PMD 违规 | $(jq -r '.metrics.static_analysis.pmd_violations' $LATEST) |"
echo "| SpotBugs | $(jq -r '.metrics.static_analysis.spotbugs_warnings' $LATEST) |"
```

---

## ⚙️ CI 集成

### 自动化流程

```mermaid
graph LR
    A[每周一凌晨] --> B[运行测试]
    B --> C[采集指标]
    C --> D[生成报告]
    D --> E[提交数据]
    E --> F[更新看板]
```

### 手动触发

在 GitHub 仓库页面：
1. 进入 **Actions** → **CI Quality Gate**
2. 点击 **Run workflow**
3. 可选：指定日期或启用模拟模式

---

## 🔧 故障排查

### 常见问题

#### 1. 采集脚本无法运行

```bash
# 检查权限
chmod +x scripts/quality-metrics-collector.sh

# 检查依赖
which mvn jq python3
```

#### 2. JaCoCo 报告不存在

```bash
# 确保先运行测试
cd koduck-backend
mvn clean test jacoco:report
```

#### 3. JSON 解析失败

```bash
# 安装 jq
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

---

## 📚 相关文档

- [质量检查指南](../quality-check-guide.md)
- [PMD 待办治理](./pmd-backlog-governance.md)
- [覆盖率门禁计划](./coverage-gate-plan.md)
- [静态分析配置](../../koduck-backend/config/pmd/ruleset-phase2.xml)

---

## 📝 更新日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-04-01 | v1.0 | 初始版本，建立质量趋势看板 |

---

**维护说明**: 本看板由 CI 自动更新，如需修改配置请编辑 `.github/workflows/ci-quality-gate.yml` 和 `scripts/quality-metrics-collector.sh`。
