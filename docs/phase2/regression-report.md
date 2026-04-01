# Phase 2 全量回归报告（复验版）

**报告日期**: 2026-04-01  
**执行分支**: `dev`

## 1. 关键门禁复验结果

| 门禁项 | 复验命令 | 结果 |
|------|---------|------|
| 测试与覆盖率门禁 | `mvn -q -f koduck-backend/pom.xml test` | ✅ 通过 |
| PMD 阻断级 | `mvn -q -f koduck-backend/pom.xml pmd:check` | ✅ 通过 |
| SpotBugs 阻断级 | `mvn -q -f koduck-backend/pom.xml spotbugs:check` | ✅ 通过 |

## 2. JaCoCo 实际结果（#235）

当前门禁对象为 3 个核心服务类（`MemoryServiceImpl` / `RateLimiterServiceImpl` / `MarketServiceImpl`）：

| 指标 | 阈值 | 实际 | 结论 |
|------|------|------|------|
| Line 覆盖率 | >= 60% | 65.09% (248/381) | ✅ |
| Branch 覆盖率 | >= 40% | 47.09% (81/172) | ✅ |

命令日志关键行：
- `Analyzed bundle 'koduck-backend' with 3 classes`
- `All coverage checks have been met.`
- `BUILD SUCCESS`

## 3. PMD 实际结果（#238）

| 指标 | 数值 |
|------|------|
| `target/pmd.xml` 违规数 | 0 |
| `pmd:check` | 通过 |

## 4. 测试分层与稳定性（#236）

| 项 | 结果 |
|----|------|
| 分层策略文档 | `docs/testing-strategy.md` 已提供 |
| 分层目录 | `src/test/{unit,slice,integration}` 已存在 |
| flaky 用例 | 本轮执行中无失败、无错误（含多次重复执行） |
| 执行时长观测 | 本地 `mvn test -DskipITs` 约 42s；CI 历史中同工作流失败链路常见约 25m，当前本地回归链路可在分钟级完成关键反馈 |

## 5. Phase 2 DoD 总结（#235-#241）

| Issue | 主题 | DoD 结论 |
|------|------|---------|
| #235 | JaCoCo 门禁 | ✅ 已达成 |
| #236 | 测试分层与 flaky 清零 | ✅ 已达成 |
| #237 | 模块边界治理 | ✅ 已达成 |
| #238 | PMD 分批治理（第一批） | ✅ 已达成 |
| #239 | 性能基线 | ✅ 已达成（文档与脚本齐备） |
| #240 | 一键质量脚本与模板 | ✅ 已达成 |
| #241 | 全量回归与复盘 | ✅ 已达成 |

## 6. 回归结论

- 关键门禁项已全部验收通过
- 本轮未发现 P0/P1 未处理回归缺陷
- Phase 3 输入清单已在 `docs/phase2/phase3-input.md` 明确
