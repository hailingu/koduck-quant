//! ANCHOR_FIRST retrieval strategy implementation.
//!
//! Candidate channels are fixed to:
//! - domain
//! - entity
//! - relation
//! - session scope
//!
//! `time_bucket` is intentionally excluded from inverted retrieval in V1.

use std::cmp::Ordering;
use std::collections::{BTreeSet, HashMap};

use chrono::{DateTime, Datelike, Utc};
use sqlx::PgPool;
use tracing::{debug, info, instrument};
use uuid::Uuid;

use crate::Result;
use crate::memory_anchor::{MemoryUnitAnchorRepository, MemoryUnitAnchorType};
use crate::memory_unit::MemoryUnitKind;
use crate::memory_unit::MemoryUnitRepository;
use crate::retrieve::semantics::{QueryIntentType, map_intent_to_discourse_action};
use crate::retrieve::types::{RetrieveContext, RetrieveResult, match_reason};

const CANDIDATE_EXPANSION_FACTOR: i64 = 6;
const CHANNEL_LIMIT_FLOOR: i64 = 24;
const WEIGHT_DOMAIN: f32 = 0.30;
const WEIGHT_ENTITY: f32 = 0.35;
const WEIGHT_RELATION: f32 = 0.15;
const WEIGHT_INTENT: f32 = 0.05;
const WEIGHT_RECENCY: f32 = 0.10;
const WEIGHT_SALIENCE: f32 = 0.05;

#[derive(Clone)]
pub struct AnchorFirstRetriever {
    anchor_repo: MemoryUnitAnchorRepository,
    unit_repo: MemoryUnitRepository,
}

#[derive(Debug, Clone)]
struct CandidateSignal {
    reasons: BTreeSet<String>,
    domain_score: f32,
    entity_score: f32,
    relation_score: f32,
    intent_score: f32,
}

impl CandidateSignal {
    fn new() -> Self {
        Self {
            reasons: BTreeSet::new(),
            domain_score: 0.0,
            entity_score: 0.0,
            relation_score: 0.0,
            intent_score: 0.0,
        }
    }
}

impl AnchorFirstRetriever {
    pub fn new(pool: &PgPool) -> Self {
        Self {
            anchor_repo: MemoryUnitAnchorRepository::new(pool),
            unit_repo: MemoryUnitRepository::new(pool),
        }
    }

    #[instrument(skip(self, ctx), fields(tenant_id = %ctx.tenant_id, domain_class = %ctx.domain_class))]
    pub async fn retrieve(&self, ctx: &RetrieveContext) -> Result<Vec<RetrieveResult>> {
        let limit = ctx.top_k.max(1) as usize;
        let channel_limit = (ctx.top_k.max(1) as i64 * CANDIDATE_EXPANSION_FACTOR)
            .max(CHANNEL_LIMIT_FLOOR);

        let mut candidates: HashMap<Uuid, CandidateSignal> = HashMap::new();

        let mut domain_keys = if ctx.domain_classes.is_empty() {
            Vec::new()
        } else {
            ctx.domain_classes.clone()
        };
        if domain_keys.is_empty() && !ctx.domain_class.trim().is_empty() {
            domain_keys.push(ctx.domain_class.clone());
        }
        for domain_key in domain_keys {
            let anchors = self
                .anchor_repo
                .list_by_anchor(&ctx.tenant_id, MemoryUnitAnchorType::Domain, &domain_key, channel_limit)
                .await?;
            for anchor in anchors {
                let candidate = candidates
                    .entry(anchor.memory_unit_id)
                    .or_insert_with(CandidateSignal::new);
                candidate.reasons.insert(match_reason::DOMAIN_HIT.to_string());
                candidate.domain_score += anchor.weight as f32;
            }
        }

        for entity in &ctx.entities {
            let anchors = self
                .anchor_repo
                .list_by_anchor(&ctx.tenant_id, MemoryUnitAnchorType::Entity, entity, channel_limit)
                .await?;
            for anchor in anchors {
                let candidate = candidates
                    .entry(anchor.memory_unit_id)
                    .or_insert_with(CandidateSignal::new);
                candidate.reasons.insert(match_reason::ENTITY_HIT.to_string());
                candidate.entity_score += anchor.weight as f32;
            }
        }

        for relation in &ctx.relation_types {
            let anchors = self
                .anchor_repo
                .list_by_anchor(
                    &ctx.tenant_id,
                    MemoryUnitAnchorType::Relation,
                    relation,
                    channel_limit,
                )
                .await?;
            for anchor in anchors {
                let candidate = candidates
                    .entry(anchor.memory_unit_id)
                    .or_insert_with(CandidateSignal::new);
                candidate.reasons.insert(match_reason::RELATION_HIT.to_string());
                candidate.relation_score += anchor.weight as f32;
            }
        }

        if let Some(discourse_action) = parse_intent_type(&ctx.intent_type)
            .and_then(map_intent_to_discourse_action)
        {
            let anchors = self
                .anchor_repo
                .list_by_anchor(
                    &ctx.tenant_id,
                    MemoryUnitAnchorType::DiscourseAction,
                    discourse_action.as_str(),
                    channel_limit,
                )
                .await?;
            for anchor in anchors {
                if let Some(candidate) = candidates.get_mut(&anchor.memory_unit_id) {
                    apply_intent_signal(candidate, anchor.weight as f32);
                }
            }
        }

        if let Some(session_id) = ctx
            .session_id
            .as_ref()
            .and_then(|value| Uuid::parse_str(value).ok())
        {
            let units = self
                .unit_repo
                .list_by_session(&ctx.tenant_id, session_id, channel_limit)
                .await?;
            for unit in units {
                let candidate = candidates
                    .entry(unit.memory_unit_id)
                    .or_insert_with(CandidateSignal::new);
                candidate
                    .reasons
                    .insert(match_reason::SESSION_SCOPE_HIT.to_string());
            }
        }

        if candidates.is_empty() {
            debug!("ANCHOR_FIRST found no candidates");
            return Ok(Vec::new());
        }

        let now = chrono::Utc::now();
        let mut results = Vec::new();
        for (memory_unit_id, signal) in candidates {
            if let Some(unit) = self
                .unit_repo
                .get_by_id(&ctx.tenant_id, memory_unit_id)
                .await?
            {
                let recency_score = recency_score(unit.updated_at, unit.time_bucket.as_deref(), now);
                let salience_score = unit.salience_score.unwrap_or(0.0).clamp(0.0, 1.0) as f32;
                let final_score = combine_scores(
                    signal.domain_score,
                    signal.entity_score,
                    signal.relation_score,
                    signal.intent_score,
                    recency_score,
                    salience_score,
                );
                let snippet = unit
                    .snippet
                    .clone()
                    .or_else(|| unit.summary_state.summary.clone())
                    .unwrap_or_else(|| unit.source_uri.clone());

                let mut result = RetrieveResult::new(
                    unit.session_id.to_string(),
                    unit.source_uri,
                    final_score,
                    snippet,
                );
                for reason in signal.reasons {
                    result = result.with_match_reason(reason);
                }
                if unit.memory_kind == MemoryUnitKind::Fact {
                    result = result.with_match_reason(match_reason::FACT_HIT);
                }
                if recency_score > 0.0 {
                    result = result.with_match_reason(match_reason::RECENCY_BOOST);
                }
                results.push((result, unit.updated_at));
            }
        }

        results.sort_by(|(left, left_time), (right, right_time)| {
            right
                .score
                .partial_cmp(&left.score)
                .unwrap_or(Ordering::Equal)
                .then_with(|| right_time.cmp(left_time))
        });

        let merged = results
            .into_iter()
            .take(limit)
            .map(|(result, _)| result)
            .collect::<Vec<_>>();

        info!(
            result_count = merged.len(),
            tenant_id = %ctx.tenant_id,
            "ANCHOR_FIRST retrieval completed"
        );

        Ok(merged)
    }
}

fn apply_intent_signal(candidate: &mut CandidateSignal, intent_anchor_weight: f32) {
    // intent_score is a weak signal and must not duplicate relation semantics.
    if candidate
        .reasons
        .contains(match_reason::RELATION_HIT)
    {
        return;
    }
    candidate
        .reasons
        .insert(match_reason::DISCOURSE_ACTION_HIT.to_string());
    candidate.intent_score += intent_anchor_weight;
}

fn combine_scores(
    domain_score: f32,
    entity_score: f32,
    relation_score: f32,
    intent_score: f32,
    recency_score: f32,
    salience_score: f32,
) -> f32 {
    (domain_score.clamp(0.0, 1.0) * WEIGHT_DOMAIN
        + entity_score.clamp(0.0, 1.0) * WEIGHT_ENTITY
        + relation_score.clamp(0.0, 1.0) * WEIGHT_RELATION
        + intent_score.clamp(0.0, 1.0) * WEIGHT_INTENT
        + recency_score.clamp(0.0, 1.0) * WEIGHT_RECENCY
        + salience_score.clamp(0.0, 1.0) * WEIGHT_SALIENCE)
        .clamp(0.0, 1.0)
}

fn recency_score(updated_at: DateTime<Utc>, time_bucket: Option<&str>, now: DateTime<Utc>) -> f32 {
    let by_updated_at: f32 = if updated_at > now - chrono::Duration::days(3) {
        1.0
    } else if updated_at > now - chrono::Duration::days(14) {
        0.6
    } else if updated_at > now - chrono::Duration::days(30) {
        0.3
    } else {
        0.0
    };

    let by_time_bucket = time_bucket
        .and_then(|bucket| parse_time_bucket_ym(bucket, now))
        .unwrap_or(0.0);

    by_updated_at.max(by_time_bucket)
}

fn parse_time_bucket_ym(value: &str, now: DateTime<Utc>) -> Option<f32> {
    let mut chunks = value.split('-');
    let year = chunks.next()?.parse::<i32>().ok()?;
    let month = chunks.next()?.parse::<u32>().ok()?;
    if chunks.next().is_some() || !(1..=12).contains(&month) {
        return None;
    }

    let current_month_idx = now.year() * 12 + i32::try_from(now.month()).ok()?;
    let bucket_month_idx = year * 12 + i32::try_from(month).ok()?;
    let month_gap = current_month_idx - bucket_month_idx;

    let score = if month_gap <= 0 {
        1.0
    } else if month_gap == 1 {
        0.7
    } else if month_gap == 2 {
        0.4
    } else if month_gap <= 6 {
        0.2
    } else {
        0.0
    };
    Some(score)
}

fn parse_intent_type(value: &str) -> Option<QueryIntentType> {
    match value {
        "recall" => Some(QueryIntentType::Recall),
        "compare" => Some(QueryIntentType::Compare),
        "disambiguate" => Some(QueryIntentType::Disambiguate),
        "correct" => Some(QueryIntentType::Correct),
        "explain" => Some(QueryIntentType::Explain),
        "decide" => Some(QueryIntentType::Decide),
        "none" => Some(QueryIntentType::None),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn combine_scores_uses_frozen_weights() {
        let score = combine_scores(1.0, 1.0, 1.0, 1.0, 1.0, 1.0);
        assert!((score - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn intent_score_does_not_double_count_relation_signal() {
        let mut signal = CandidateSignal::new();
        signal
            .reasons
            .insert(match_reason::RELATION_HIT.to_string());

        apply_intent_signal(&mut signal, 1.0);

        assert_eq!(signal.intent_score, 0.0);
        assert!(!signal
            .reasons
            .contains(match_reason::DISCOURSE_ACTION_HIT));
    }

    #[test]
    fn time_bucket_participates_only_through_recency_score() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-04-14T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let stale_updated_at = chrono::DateTime::parse_from_rfc3339("2026-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let with_bucket = recency_score(stale_updated_at, Some("2026-04"), now);
        let without_bucket = recency_score(stale_updated_at, None, now);

        assert!(with_bucket > without_bucket);
        assert_eq!(without_bucket, 0.0);
    }
}
