# Test automation scripts

- `test-audit.js`: runs tests list and coverage report, writes `reports/test-audit-YYYYMMDD.json`
- `flaky-detector.js`: runs a given test multiple times to flag flakiness

Usage:

```bash
node scripts/test-audit.js --out reports/test-audit.json
node scripts/flaky-detector.js --target test/unit/di/scope-manager.test.ts --runs 10 --out reports/flaky-scope-manager.json

```
