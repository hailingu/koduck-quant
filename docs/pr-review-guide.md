# PR 审阅指南

本文档说明 koduck-quant 项目的 PR 审阅流程、规范及相关工具使用。

## 📋 目录

- [CODEOWNERS 机制](#codeowners-机制)
- [PR 模板使用](#pr-模板使用)
- [审阅 SLA 指标](#审阅-sla-指标)
- [PR 指标统计工具](#pr-指标统计工具)

---

## CODEOWNERS 机制

### 什么是 CODEOWNERS

CODEOWNERS 是 GitHub 提供的代码所有者机制，用于：
- **自动分配审阅者**：当 PR 修改特定文件时，自动请求相关所有者审查
- **强制审查要求**：可配置必须通过代码所有者的审查才能合并
- **责任明确**：每个模块/目录都有明确的责任人

### 当前配置

| 目录/文件 | 所有者 | 说明 |
|-----------|--------|------|
| `*` | @hailingu | 默认所有者 |
| `/.github/workflows/` | @hailingu | CI/CD 配置 |
| `/koduck-backend/` | @hailingu | Java 后端 |
| `/koduck-frontend/` | @hailingu | React 前端 |
| `/koduck-agent/` | @hailingu | Python Agent |
| `/koduck-data-service/` | @hailingu | Python 数据服务 |
| `/docs/` | @hailingu | 文档 |

### CODEOWNERS 文件位置

```
.github/CODEOWNERS
```

### 如何更新 CODEOWNERS

1. 编辑 `.github/CODEOWNERS` 文件
2. 遵循格式：`<pattern> <owner1> <owner2> ...`
3. 提交 PR 进行变更

---

## PR 模板使用

### 模板位置

```
.github/PULL_REQUEST_TEMPLATE.md
```

### 模板结构

PR 模板包含以下必填部分：

#### 1. 变更摘要
- 变更目的和内容简述
- 关联 Issue
- 变更类型（feat/fix/refactor 等）

#### 2. 影响面评估 ⚠️
- **影响范围**：单个模块/多模块/API 变更等
- **受影响模块**：列出具体文件/模块
- **用户影响**：是否有用户可见的变更

#### 3. 风险评估 🚨
- **风险等级**：🟢 低 / 🟡 中 / 🔴 高
- **潜在风险点**：列出可能的副作用
- **缓解措施**：针对风险采取的措施

#### 4. 验证清单 ✅
- 代码质量检查
- 测试验证（单元测试、集成测试）
- 语言特有检查（Java/前端/Python）

#### 5. 回滚方案 ↩️
- **回滚触发条件**：何时需要回滚
- **回滚步骤**：详细操作步骤
- **数据影响**：是否有数据变更需要修复

#### 6. 部署与发布 📦
- 部署前检查
- 发布后验证
- 监控与告警

#### 7. 文档更新 📝
- README/API 文档/架构文档/ADR 等

---

## 审阅 SLA 指标

### 目标指标（A 线）

| 指标 | P50 目标 | P90 目标 | 说明 |
|------|----------|----------|------|
| PR 首次响应 | < 4 小时 | < 24 小时 | PR 创建到首次评论/审查的时间 |
| PR 合并周期 | < 24 小时 | < 72 小时 | PR 创建到合并的时间 |

### 指标定义

#### 首次响应时间
- **计算方式**：PR 创建时间 → 第一个非作者评论/审查的时间
- **排除**：PR 作者自己的评论
- **统计范围**：所有在统计周期内创建的 PR

#### 合并周期
- **计算方式**：PR 创建时间 → PR 合并时间
- **统计范围**：在统计周期内创建且已合并的 PR
- **未合并 PR**：不纳入合并周期统计

### 如何查看指标

```bash
# 查看最近 7 天的 PR 指标
python scripts/pr-metrics.py

# 查看最近 14 天的 PR 指标
python scripts/pr-metrics.py --days 14

# 查看指定仓库的指标
python scripts/pr-metrics.py --repo owner/repo --days 7
```

---

## PR 指标统计工具

### 安装依赖

确保已安装 GitHub CLI 并已登录：

```bash
# 安装 GitHub CLI (macOS)
brew install gh

# 登录 GitHub
gh auth login
```

### 使用脚本

```bash
# 基本使用（统计最近 7 天）
python scripts/pr-metrics.py

# 指定天数
python scripts/pr-metrics.py --days 14

# 指定仓库
python scripts/pr-metrics.py --repo hailingu/koduck-quant

# 获取更多 PR（默认 100 个）
python scripts/pr-metrics.py --limit 200
```

### 输出示例

```
======================================================================
📊 PR 审阅指标周报
仓库: hailingu/koduck-quant
统计周期: 2026-03-25 ~ 2026-04-01 (7 天)
======================================================================

📈 PR 概况:
   总计: 15 个 PR
   - 已合并: 12 个
   - 进行中: 2 个
   - 已关闭（未合并）: 1 个

⏱️  首次响应时间 (First Response Time):
   --------------------------------------------------
   P50: 2.5h ✅ (目标: < 4h)
   P90: 18.3h ✅ (目标: < 24h)
   平均: 5.2h
   有响应的 PR: 15/15 (100.0%)

🔄 合并周期 (Merge Duration):
   --------------------------------------------------
   P50: 16.8h ✅ (目标: < 24h)
   P90: 58.2h ✅ (目标: < 72h)
   平均: 22.4h

🎯 目标达成情况 (A 线):
   --------------------------------------------------
   PR 首次响应 P50 < 4h:   ✅ 达标
   PR 首次响应 P90 < 24h:  ✅ 达标
   PR 合并周期 P50 < 24h:  ✅ 达标
   PR 合并周期 P90 < 72h:  ✅ 达标
```

### 自动化周报

可以将脚本加入 CI 或定时任务，自动生成周报：

```bash
# 添加到 crontab（每周一早上 9 点生成周报）
0 9 * * 1 cd /path/to/koduck-quant && python scripts/pr-metrics.py --days 7 > reports/pr-metrics-weekly.md
```

---

## 最佳实践

### 对于 PR 作者

1. **填写完整的 PR 模板**：特别是影响面、风险、回滚方案
2. **自测充分**：在提交 PR 前完成本地验证
3. **关联 Issue**：在 PR 描述中使用 `Closes #xxx` 关联相关 Issue
4. **保持小而聚焦**：单个 PR 的变更范围应尽量小
5. **响应及时**：及时响应审阅者的反馈

### 对于审阅者

1. **及时响应**：在 SLA 时间内给出首次反馈
2. **关注关键点**：
   - 影响面评估是否准确
   - 风险是否被充分识别
   - 回滚方案是否可行
   - 测试是否充分
3. **建设性反馈**：给出具体的改进建议
4. **区分阻塞与非阻塞**：明确哪些是必须修改的，哪些可以后续优化

### 对于维护者

1. **定期审查指标**：使用脚本监控 PR 审阅效率
2. **调整流程**：根据指标调整工作流程
3. **更新 CODEOWNERS**：随着团队扩大，细化代码所有者
4. **模板优化**：根据实际使用情况优化 PR 模板

---

## 参考链接

- [GitHub CODEOWNERS 文档](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub PR 模板文档](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)
- [项目贡献指南](../CONTRIBUTING.md)
