# ADR-0034: Internal `ANCHOR_FIRST` Retrieval Path

- Status: Accepted
- Date: 2026-04-14
- Issue: #861

## Context

Task 4.1 requires moving retrieval to an anchor-based internal main path while keeping the external gRPC `RetrievePolicy` contract unchanged.

Before this change:

1. `QueryMemory` used `DOMAIN_FIRST` / `SUMMARY_FIRST` implementations centered on `memory_index_records`.
2. Anchor-based units (`memory_units` + `memory_unit_anchors`) existed, but were not the default retrieval backbone.
3. `ANCHOR_FIRST` did not exist as a dedicated service-internal retriever.

This made it hard to guarantee channel governance (`domain/entity/relation/session scope`) and memory-unit granularity behavior.

## Decision

### 1. Introduce internal `AnchorFirstRetriever`

Add `retrieve/anchor_first.rs` and implement an internal retriever that:

- recalls candidates only through four channels:
  - `domain`
  - `entity`
  - `relation`
  - `session scope`
- merges and deduplicates candidate `memory_unit_id`s
- preserves source channels as `match_reasons`
- materializes `MemoryHit` from `memory_units`

`time_bucket` is explicitly not used as an inverted candidate channel.

### 2. Keep external retrieve policy unchanged

Do **not** add new proto enum values.

- `RETRIEVE_POLICY_DOMAIN_FIRST` and `UNSPECIFIED` now route internally to `ANCHOR_FIRST`.
- `RETRIEVE_POLICY_HYBRID` still falls back, now to `ANCHOR_FIRST`.
- `RETRIEVE_POLICY_SUMMARY_FIRST` keeps summary gate behavior, but candidate collection starts from `ANCHOR_FIRST`.

So `ANCHOR_FIRST` is service-internal and not exposed as a new external retrieve policy.

### 3. Ensure generic conversation units participate in domain channel

For appended generic conversation units, materializer now writes:

- `domain` anchor with default `chat`
- `discourse_action` anchor (existing logic)
- projection sync to `domain_class_primary`

This prevents domain channel starvation for non-summary/non-fact units.

## Consequences

Positive:

1. Retrieval backbone is now memory-unit + anchor based.
2. Candidate channels are explicitly governed and testable.
3. `SUMMARY_FIRST` remains backward-compatible at API level while inheriting anchor candidate behavior.

Trade-offs:

1. Scoring is still heuristic and will be further tightened in later tasks.
2. Match-reason closed-set cleanup is deferred to Task 4.2.

## Compatibility Impact

1. No gRPC contract change (`memory.v1` unchanged).
2. No new external retrieve policy value.
3. Existing clients continue to call the same API and enum values.

## Alternatives Considered

### Alternative A: Add `ANCHOR_FIRST` as a new proto `RetrievePolicy`

Rejected in Task 4.1 because requirement explicitly says internal-only.

### Alternative B: Keep `DOMAIN_FIRST` as the main path and add anchor path as optional

Rejected because Phase 4 requires anchor-based retrieval as main internal route.

### Alternative C: Use `time_bucket` as an inverted candidate channel

Rejected because Task 4.1 requires time dimension not to be used as candidate entry.
