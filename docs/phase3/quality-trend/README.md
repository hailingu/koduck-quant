# 质量趋势数据

本目录存放 koduck-backend 项目的周维度质量指标数据。

## 文件命名规范

```
quality-metrics-YYYY-MM-DD.json
```

- `YYYY-MM-DD`: 采集日期（每周一）

## 数据格式

```json
{
  "week": "2026-W14",
  "date": "2026-04-01",
  "timestamp": "2026-04-01T10:00:00",
  "project": "koduck-backend",
  "version": "0.1.0-SNAPSHOT",
  "metrics": {
    "tests": {
      "total": 116,
      "passed": 116,
      "failed": 0,
      "skipped": 0,
      "duration_seconds": 45,
      "pass_rate": 100.0
    },
    "coverage": {
      "line_percent": 40.6,
      "branch_percent": 29.6,
      "instruction_percent": 35.2
    },
    "static_analysis": {
      "pmd_violations": 0,
      "spotbugs_warnings": 0
    },
    "code": {
      "files": 345,
      "lines": 25000,
      "classes": 450,
      "methods": 1800
    }
  }
}
```

## 数据文件列表

| 文件 | 周次 | 说明 |
|------|------|------|
| [quality-metrics-2026-03-04.json](./quality-metrics-2026-03-04.json) | W10 | Phase 2 基线 |
| [quality-metrics-2026-03-11.json](./quality-metrics-2026-03-11.json) | W11 | 第一周 |
| [quality-metrics-2026-03-18.json](./quality-metrics-2026-03-18.json) | W12 | 第二周 |
| [quality-metrics-2026-03-25.json](./quality-metrics-2026-03-25.json) | W13 | 第三周 |
| [quality-metrics-2026-04-01.json](./quality-metrics-2026-04-01.json) | W14 | 当前 |

## 查看趋势

```bash
# 查看最新数据
cat quality-metrics-$(date +%Y-%m-%d).json | jq

# 查看所有数据文件
ls -lt quality-metrics-*.json

# 使用脚本查看趋势
../../scripts/quality-metrics-collector.sh --skip-tests
```

## 自动化采集

质量数据由 GitHub Actions 自动采集：
- **定时触发**: 每周一凌晨 2:00 UTC
- **工作流**: `.github/workflows/ci-quality-gate.yml`
- **采集脚本**: `scripts/quality-metrics-collector.sh`

## 相关文档

- [质量看板文档](../quality-dashboard.md)
