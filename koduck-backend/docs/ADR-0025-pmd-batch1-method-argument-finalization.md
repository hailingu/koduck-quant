# ADR-0025: PMD 第一轮治理完成（MethodArgumentCouldBeFinal）

- Status: Accepted
- Date: 2026-04-02
- Issue: #338

## Context

PMD 存量治理计划中，Batch 1 目标为清理并启用 `MethodArgumentCouldBeFinal` 规则。此前该规则在 `ruleset-phase2.xml` 中被排除，导致第一轮治理未真正收口。

## Decision

完成 Batch 1 收口动作：

1. 从 `ruleset-phase2.xml` 移除 `MethodArgumentCouldBeFinal` 排除项；
2. 执行全量 PMD 扫描确认该规则违规数为 0；
3. 将 PMD 存量基线 `debt-baseline.txt` 从 9951 下调到 0。

## Consequences

正向影响：

- Batch 1 规则进入持续生效状态；
- PMD 债务基线与当前扫描结果对齐；
- 质量门禁从“计划治理”进入“已治理并守住”。

代价：

- 后续任何回退将被 ratchet 机制阻断，需要团队持续保持编码规范。

## Alternatives Considered

1. 继续保留规则排除，仅更新文档状态
   - 拒绝：没有实际治理结果，无法形成约束闭环。

2. 启用规则但不下调基线
   - 未采用：基线与事实不一致，失去审计价值。

## Verification

- `mvn -q -f koduck-backend/pom.xml pmd:pmd` 生成报告，`MethodArgumentCouldBeFinal` 违规为 0；
- `./scripts/pmd-debt-guard.sh --update-baseline` 执行成功，基线已更新为 0；
- `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过。
