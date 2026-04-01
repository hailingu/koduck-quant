# ADR-0024: PMD 存量债务引入 Ratchet 守门机制

- Status: Accepted
- Date: 2026-04-02
- Issue: #336

## Context

当前 PMD 存量违规规模较大（历史基线约 9951），仅依赖 `pmd:check`（阻断级）无法防止存量回退，存在：

- 新增与存量混淆，难以量化治理成效；
- 质量治理依赖人工巡检，缺少自动化约束；
- P0 技术债务缺乏可执行、可审计的收敛机制。

## Decision

建立“新增零容忍 + 存量非回退”治理机制：

1. 基线文件：`config/pmd/debt-baseline.txt` 记录当前存量上限；
2. 守门脚本：`scripts/pmd-debt-guard.sh` 比较 `target/pmd.xml` 与基线；
3. CI 门禁：新增 `ci-pmd-debt-guard.yml` 在 `dev/main` push/PR 自动执行；
4. 本地入口：`make quality-pmd-debt` 和 `quality-check.sh` 集成。

## Consequences

正向影响：

- PMD 存量可度量，且任何回退会被自动阻断；
- 为分批清债提供稳定“只降不升”护栏；
- 团队可通过更新基线（仅允许下降）持续沉淀治理进度。

代价：

- CI 增加一次 PMD 扫描，构建时长略增；
- 需要在批次清理完成后维护基线文件更新流程。

## Alternatives Considered

1. 仅维持 `pmd:check`
   - 拒绝：无法约束存量回退。

2. 一次性清零全部 9951 违规
   - 未采用：风险高、周期长，不利于持续交付。

## Verification

- 新增 `scripts/pmd-debt-guard.sh` 与 `config/pmd/debt-baseline.txt`；
- 新增 CI 工作流 `ci-pmd-debt-guard.yml`；
- 本地 `mvn -DskipTests compile -f koduck-backend/pom.xml` 通过；
- 本地 `./scripts/pmd-debt-guard.sh` 可执行并输出基线对比结果。
