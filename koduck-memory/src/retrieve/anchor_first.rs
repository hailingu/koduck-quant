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

use sqlx::PgPool;
use tracing::{debug, info, instrument};
use uuid::Uuid;

use crate::Result;
use crate::memory_anchor::{MemoryUnitAnchorRepository, MemoryUnitAnchorType};
use crate::memory_unit::MemoryUnitRepository;
use crate::retrieve::types::{RetrieveContext, RetrieveResult, match_reason};

const CANDIDATE_EXPANSION_FACTOR: i64 = 6;
const CHANNEL_LIMIT_FLOOR: i64 = 24;

#[derive(Clone)]
pub struct AnchorFirstRetriever {
    anchor_repo: MemoryUnitAnchorRepository,
    unit_repo: MemoryUnitRepository,
}

#[derive(Debug, Clone)]
struct CandidateSignal {
    reasons: BTreeSet<String>,
    score_hint: f32,
}

impl CandidateSignal {
    fn new() -> Self {
        Self {
            reasons: BTreeSet::new(),
            score_hint: 0.0,
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
                candidate.reasons.insert(match_reason::DOMAIN_CLASS_HIT.to_string());
                candidate.score_hint += 0.35 * anchor.weight as f32;
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
                candidate.score_hint += 0.30 * anchor.weight as f32;
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
                candidate.score_hint += 0.25 * anchor.weight as f32;
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
                candidate.score_hint += 0.20;
            }
        }

        if candidates.is_empty() {
            debug!("ANCHOR_FIRST found no candidates");
            return Ok(Vec::new());
        }

        let mut results = Vec::new();
        for (memory_unit_id, signal) in candidates {
            if let Some(unit) = self
                .unit_repo
                .get_by_id(&ctx.tenant_id, memory_unit_id)
                .await?
            {
                let recency_boost = if unit.updated_at > chrono::Utc::now() - chrono::Duration::days(3)
                {
                    0.12
                } else {
                    0.0
                };
                let salience = unit.salience_score.unwrap_or(0.0) as f32 * 0.08;
                let final_score = (signal.score_hint + recency_boost + salience).clamp(0.0, 1.0);
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

