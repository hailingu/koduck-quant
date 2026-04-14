# ADR-0035: Match Reasons Closed Set and Output Governance

- Status: Accepted
- Date: 2026-04-14
- Issue: #863

## Context

Task 4.1 established internal `ANCHOR_FIRST` retrieval, but `match_reasons` values still had
drift risk across retrievers and tests. We need a closed set for stable downstream behavior and
explainability while keeping `QueryMemory` output contract unchanged.

Task 4.2 requires:

1. Freeze `match_reasons` to a closed set.
2. Keep `QueryMemory` main path returning `MemoryHit`.
3. Avoid attaching recall batch intermediate materials to `MemoryHit`.

## Decision

### 1) Freeze `match_reasons` closed set at retrieval output boundary

`match_reasons` is governed by:

- `domain_hit`
- `entity_hit`
- `relation_hit`
- `discourse_action_hit`
- `session_scope_hit`
- `summary_hit`
- `fact_hit`
- `recency_boost`

Any value outside this set is filtered out before `QueryMemory` returns `MemoryHit`.

### 2) Add explicit normalization API

In `retrieve/types.rs`:

- add `match_reason::is_closed_set_value(...)`
- add `match_reason::normalize_output(...)`

`QueryMemory` applies `normalize_output` when converting internal `RetrieveResult` to external
`MemoryHit`.

### 3) Keep contract shape unchanged

No `memory.v1` schema change. `QueryMemory` still returns `MemoryHit` list with existing fields:

- `session_id`
- `l0_uri`
- `score`
- `match_reasons`
- `snippet`

No batch intermediate recall materials are appended to the output payload.

## Consequences

Positive:

1. Output reasons are deterministic and bounded.
2. Downstream consumers can rely on stable reason taxonomy.
3. Internal retriever evolution is safer because output has a normalization guardrail.

Trade-offs:

1. Unknown or experimental reasons are dropped unless explicitly added to the closed set.
2. Future reason extensions require coordinated ADR/task updates.

## Compatibility Impact

1. gRPC schema remains unchanged.
2. Output field set remains unchanged.
3. Existing clients continue to parse `MemoryHit` as before; only reason vocabulary is stabilized.

## Alternatives Considered

### Alternative A: Let each retriever emit arbitrary reasons

Rejected. This creates open-set drift and weakens explainability consistency.

### Alternative B: Expose a new output field for raw internal reasons

Rejected for Task 4.2 to keep `memory.v1` compatibility and avoid payload complexity.
