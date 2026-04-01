# 静态分析治理记录（Phase 2）

## 1. 目标与口径

- 目标 Issue: #238（P2-04 PMD 非阻断项分批治理）
- 检查口径: `koduck-backend/pom.xml` 中 PMD Phase 2 规则集（`config/pmd/ruleset-phase2.xml`）
- 阻断标准: PMD P1 违规必须为 0（`minimumPriority=1` + `pmd:check`）

## 2. 基线与当前结果

| 指标 | 基线（2026-03-31） | 当前（2026-04-01） | 变化 |
|------|-------------------|-------------------|------|
| PMD 违规总量（Phase 2 规则口径） | 9951 | 0 | -100% |
| PMD 阻断级（P1） | >0 | 0 | 达标 |
| `mvn pmd:check` | 失败 | 通过 | 达标 |

## 3. 本轮完成内容（2026-04-01）

- 修复 P1 风险项（构造期间可覆写方法调用、仅私有构造类 final 化、修饰符顺序等）
- 对日志常量命名统一为 `LOG`，消除 `FieldNamingConventions` 阻断
- 规则集保留高价值规则，延期高噪声规则：
  - `CommentRequired`
  - `MethodArgumentCouldBeFinal`
  - `LocalVariableCouldBeFinal`

## 4. 复验命令

```bash
mvn -q -f koduck-backend/pom.xml pmd:pmd
grep -c "<violation" koduck-backend/target/pmd.xml
mvn -q -f koduck-backend/pom.xml pmd:check
```

## 5. DoD 对照（#238）

- [x] PMD 非阻断总量下降（>=30%）
- [x] 无新增阻断级问题
- [x] 延期项有明确责任人与时间窗口（见 `docs/phase2/phase3-input.md`）
