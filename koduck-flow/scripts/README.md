# KoduckFlow Scripts

This directory keeps the actively maintained automation scripts used by
`koduck-flow` package commands.

## Active entry points

Most active scripts are called from `package.json`:

- Build and dependency checks: `build-di.mjs`, `check-bundle-size.mjs`,
  `validate-dependency-graph.mjs`
- Coverage: `verify-coverage.mjs`, `generate-coverage-digest.mjs`,
  `track-coverage.mjs`, `upload-coverage-codecov.mjs`,
  `upload-coverage-coveralls.mjs`
- Documentation and config: `check-jsdoc-coverage.js`,
  `sync-env-artifacts.ts`
- Scaffolding and monitoring: `create-scaffold.ts`,
  `performance-monitor.ts`, `stability-summary.ts`, `chaos-runner.ts`

## Archived scripts

Deprecated one-off migration and legacy test utility scripts have been moved to
`archive/`. They are kept for historical reference only and should not be used
as part of the normal development workflow.

See `archive/README.md` for details.
