# Phase 3 DoD 收口清单（代码事实版）

> 更新时间: 2026-04-01  
> 关联父任务: #260

## 1. 命令级证据

| 项目 | 命令 | 结果 |
|---|---|---|
| 单元测试 3 连跑 | `mvn -q -f koduck-backend/pom.xml test` (x3) | ✅ 通过 |
| PMD 门禁 | `mvn -q -f koduck-backend/pom.xml pmd:check` | ✅ 通过 |
| SpotBugs 门禁 | `mvn -q -f koduck-backend/pom.xml spotbugs:check` | ✅ 通过 |

日志文件：
- `/tmp/p3_mvn_test_1.log`
- `/tmp/p3_mvn_test_2.log`
- `/tmp/p3_mvn_test_3.log`

## 2. 子 Issue DoD 状态

| Issue | DoD 状态 | 证据 |
|---|---|---|
| #250 P3-01 覆盖率门禁扩围 | ✅ 已满足 | `koduck-backend/pom.xml`（8 类 includes + 60/40 阈值）、`docs/phase3/coverage-gate-plan.md` |
| #251 P3-02 核心服务单测补齐 | ✅ 已满足 | `jacoco.csv` 中 `AiAnalysisServiceImpl` 72.9%、`PortfolioServiceImpl` 67.9%、`MarketServiceImpl` 72.1%（分支） |
| #252 P3-03 flaky 治理机制化 | 🟡 部分满足 | `.github/workflows/flaky-tracker.yml` + `docs/testing-flaky-playbook.md` 已就绪；“连续两周 0 flaky”待时间序列证据 |
| #253 P3-04 集成测试主流程增强 | 🟡 部分满足 | `.github/workflows/ci-backend-integration.yml` 与 `docs/integration-test-guide.md` 已具备；“最近 3 次 CI 通过记录”待补 |
| #254 P3-05 PMD 存量治理机制 | ✅ 已满足 | `docs/phase3/pmd-backlog-governance.md` 已补周维度台账；`pmd:check` 通过 |
| #255 P3-06 性能基线实测 | ✅ 已满足 | `docs/phase3/perf-test-run-2026-04-01.md`（本地基线口径 + 3 API P50/P95/P99/错误率 + 可复现实验参数） |
| #256 P3-07 性能优化闭环 | ✅ 已满足 | `docs/phase3/performance-optimization-report.md` + `docs/phase3/optimization-summary.md` |
| #257 P3-08 API 文档质量完善 | ✅ 已满足 | Controller 注解修复后 `mvn test` 可通过；回归报告已同步 |
| #258 P3-09 质量趋势看板 | ✅ 已满足 | `docs/phase3/quality-dashboard.md` 与 `.github/workflows/ci-quality-gate.yml` 一致 |
| #259 P3-10 阶段回归与复盘 | 🟡 跟随收口 | `docs/phase3/regression-report.md` 已回填最新状态，待 #252/#253 收口后关闭 |

## 3. 父任务 #260 当前结论

- 已满足: #250 #251 #254 #255 #256 #257 #258
- 待收口: #252 #253 #259
- 阻断性质: 无代码级 P0/P1 阻断；剩余为时间序列/CI 证据链补齐
