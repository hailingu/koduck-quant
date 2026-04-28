# Archived Scripts

These scripts are deprecated and retained only for historical reference.

## Migration scripts

- `migration/codemods/migrate-to-provider.ts`
- `migration/codemods/migrate-tests.ts`
- `migration/scan-legacy-api.sh`
- `migration/.eslintrc.migration.js`

These were one-off migration helpers for older provider/runtime APIs. The
current codebase uses KoduckFlow naming and the provider structure directly.

## Legacy test utilities

- `test-audit.js`
- `flaky-detector.js`

These utilities are not wired into `package.json` or CI. Prefer the active
coverage, stability, and monitoring scripts in the parent `scripts/` directory.
