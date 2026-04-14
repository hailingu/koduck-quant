# ADR-0036: Summary Gate Ready/Quality Governance

- Status: Accepted
- Date: 2026-04-14
- Issue: #865

## Context

Task 5.1 requires tightening `SUMMARY_FIRST` behavior:

1. Summary gate must apply only when `summary_status = ready`.
2. When summary is not ready, candidates should continue through anchor path and remain retrievable.
3. Low-quality summaries must not enter summary gate.

Before this change, `SUMMARY_FIRST` always attempted summary filtering once query text existed, which
could hide recent memory when summary material was pending or low quality.

## Decision

### 1) Gate eligibility becomes session-scoped and explicit

For each candidate session from `ANCHOR_FIRST`, `SUMMARY_FIRST` checks whether that session has a
latest summary unit that is:

- `summary_status = ready`
- quality-qualified by heuristic

Only these sessions are `gate-eligible`.

### 2) Non-eligible sessions bypass summary gate

If a session is not gate-eligible (`pending`/`failed`/missing/low-quality), its anchor candidates
stay in result set and are not hidden by summary filter.

This preserves recent-memory recall under pending summary state.

### 3) Negative filtering remains for eligible sessions

For gate-eligible sessions, `SUMMARY_FIRST` preserves negative filtering semantics:

- query summary index material
- keep only candidates that survive summary match
- add `summary_hit` reason for matched items

### 4) Low-quality summary heuristic

A summary is treated as low quality when it is too short or contains placeholder markers
(e.g. accepted/pending/todo style artifacts). Such summaries are excluded from gate eligibility.

## Consequences

Positive:

1. `pending` summaries no longer suppress recent anchor hits.
2. `SUMMARY_FIRST` keeps semantic value where high-quality summary exists.
3. Placeholder summaries cannot dominate retrieval behavior.

Trade-offs:

1. Quality detection is heuristic in V1 and may need iterative tuning.
2. Session-level eligibility adds a small number of repository lookups.

## Compatibility Impact

1. No changes to `memory.v1` proto or `QueryMemory` output schema.
2. Existing clients keep the same API contract.
3. Behavior improves for pending/low-quality summary edge cases without requiring client migration.

## Alternatives Considered

### Alternative A: Always apply summary gate when query text is present

Rejected because it can hide recent memory when summary is pending.

### Alternative B: Fully disable negative filtering

Rejected because Task 5.1 explicitly keeps `SUMMARY_FIRST` negative filtering semantics.

### Alternative C: Treat all `ready` summaries as high quality

Rejected because low-quality placeholders can still appear and would pollute gate behavior.
