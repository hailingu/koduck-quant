# Flyway Migration Policy (Rebased)

This directory has been rebased for **new environments only**.

## Current model

- `V1__baseline.sql` is the single bootstrap baseline.
- Historical fragmented migrations were intentionally removed.
- Future migrations must use continuous versioning starting from `V2__...`.

## Important

This baseline reset is **not** backward-compatible with previously migrated databases.
If you need to keep old environments, do not use this migration set directly.
