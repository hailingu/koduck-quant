# ADR-0037: Explainable Ranking Signal Weights (V1)

- Status: Accepted
- Date: 2026-04-14
- Issue: #867

## Context

Task 5.2 requires freezing ANCHOR_FIRST ranking semantics so retrieval order is explainable and
stable across releases.

Before this change, ranking mixed channel boosts with ad-hoc coefficients and did not clearly
separate six target signals.

## Decision

### 1) Freeze six ranking signals

V1 ranking score is composed from:

1. `domain_score`
2. `entity_score`
3. `relation_score`
4. `intent_score`
5. `recency_score`
6. `salience_score`

### 2) Freeze initial weights

The weighted score is fixed to:

- `domain 0.30`
- `entity 0.35`
- `relation 0.15`
- `intent 0.05`
- `recency 0.10`
- `salience 0.05`

Signals are normalized to `[0, 1]` before applying weights.

### 3) Avoid intent/relation double counting

`intent_score` is a weak signal and must not re-encode relation semantics already represented by
`relation_score`.

In V1, if a candidate already has `relation_hit`, we skip adding `intent_score`.

### 4) Restrict time_bucket to recency path only

`time_bucket` remains excluded from inverted recall channels. It can only affect ranking via
`recency_score` calculation (with `updated_at` as primary timestamp and `time_bucket` as fallback
hint).

## Consequences

Positive:

1. Ranking behavior is explicit and auditable.
2. Score composition aligns with ADR-0025 architecture.
3. `intent` stays weak and avoids semantic duplication with `relation`.

Trade-offs:

1. Fixed weights may need later tuning by offline/online evaluation.
2. Recency scoring currently uses heuristic buckets, not a learned model.

## Compatibility Impact

1. No change to `memory.v1` proto contract.
2. No change to `QueryMemoryResponse` schema.
3. Existing clients keep API compatibility; only internal ranking order is improved.

## Alternatives Considered

### Alternative A: Keep current mixed coefficients

Rejected because coefficients are not aligned with ADR-0025 and are harder to explain.

### Alternative B: Let intent always add on top of relation

Rejected due to repeated semantic counting and ranking drift.

### Alternative C: Use time_bucket as recall anchor

Rejected for V1 to avoid recall-path complexity and contract drift.
