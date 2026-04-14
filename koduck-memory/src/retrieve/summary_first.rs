//! SUMMARY_FIRST retrieval strategy implementation.
//!
//! This strategy performs two-stage retrieval:
//! 1. Filter by domain_class (using DomainFirstRetriever)
//! 2. Within candidates, match against summary using full-text search

use sqlx::PgPool;
use std::collections::HashSet;
use tracing::{debug, info, instrument};
use uuid::Uuid;

use crate::index::MemoryIndexRepository;
use crate::retrieve::anchor_first::AnchorFirstRetriever;
use crate::memory_unit::{MemoryUnitKind, MemoryUnitRepository};
use crate::retrieve::types::{
    match_reason, RetrieveContext, RetrieveResult,
};
use crate::Result;

/// Retriever implementing the SUMMARY_FIRST strategy.
#[derive(Clone)]
pub struct SummaryFirstRetriever {
    anchor_retriever: AnchorFirstRetriever,
    index_repo: MemoryIndexRepository,
    unit_repo: MemoryUnitRepository,
}

impl SummaryFirstRetriever {
    /// Create a new SummaryFirstRetriever.
    pub fn new(pool: &PgPool) -> Self {
        Self {
            anchor_retriever: AnchorFirstRetriever::new(pool),
            index_repo: MemoryIndexRepository::new(pool),
            unit_repo: MemoryUnitRepository::new(pool),
        }
    }

    /// Retrieve memories using SUMMARY_FIRST strategy.
    ///
    /// # Strategy
    /// 1. First, get candidates using ANCHOR_FIRST strategy.
    /// 2. If query_text is provided, perform full-text search on summary.
    /// 3. Mark records with summary_hit if they match the query.
    /// 4. Return combined results with appropriate match_reasons.
    #[instrument(skip(self, ctx), fields(tenant_id = %ctx.tenant_id, domain_class = %ctx.domain_class))]
    pub async fn retrieve(&self, ctx: &RetrieveContext) -> Result<Vec<RetrieveResult>> {
        let domain_filter = (!ctx.domain_class.trim().is_empty()).then_some(ctx.domain_class.as_str());

        // If no query text, fall back to ANCHOR_FIRST
        if ctx.query_text.trim().is_empty() {
            debug!("empty query_text, falling back to ANCHOR_FIRST");
            return self.anchor_retriever.retrieve(ctx).await;
        }

        let limit = ctx.top_k.max(1) as usize;
        let session_uuid = ctx
            .session_id
            .as_ref()
            .and_then(|session_id| uuid::Uuid::parse_str(session_id).ok());

        let anchor_candidates = self.anchor_retriever.retrieve(ctx).await?;
        if anchor_candidates.is_empty() {
            debug!("no anchor candidates found for SUMMARY_FIRST");
            return Ok(Vec::new());
        }

        let mut gate_eligible_sessions = HashSet::new();
        for session_id in unique_session_ids(&anchor_candidates) {
            if self
                .is_summary_gate_eligible_session(&ctx.tenant_id, session_id)
                .await?
            {
                gate_eligible_sessions.insert(session_id);
            }
        }
        if gate_eligible_sessions.is_empty() {
            info!(
                anchor_count = anchor_candidates.len(),
                "no ready+quality summary found, bypassing summary gate"
            );
            return Ok(anchor_candidates.into_iter().take(limit).collect());
        }

        // Perform summary search
        let summary_records = self
            .index_repo
            .search_by_summary_in_scope(
                &ctx.tenant_id,
                session_uuid,
                domain_filter.unwrap_or(""),
                &ctx.query_text,
                limit as i64 * 2,
            )
            .await?;

        debug!(
            summary_match_count = summary_records.len(),
            query_text = %ctx.query_text,
            "summary search completed"
        );

        info!(
            anchor_count = anchor_candidates.len(),
            summary_match_count = summary_records.len(),
            tenant_id = %ctx.tenant_id,
            "SUMMARY_FIRST retrieval completed"
        );

        // Build a set of record IDs that matched summary
        let summary_match_sources: HashSet<_> = summary_records
            .iter()
            .filter(|record| gate_eligible_sessions.contains(&record.session_id))
            .map(|r| r.source_uri.clone())
            .collect();

        // Summary gate applies only to sessions with ready+quality summary.
        // Sessions without gate eligibility stay on anchor path and are never hidden.
        let results = anchor_candidates
            .into_iter()
            .filter_map(|record| {
                let is_gate_session = Uuid::parse_str(&record.session_id)
                    .ok()
                    .is_some_and(|session_id| gate_eligible_sessions.contains(&session_id));
                if is_gate_session && !summary_match_sources.contains(&record.l0_uri) {
                    return None;
                }

                let mut result = record;
                if domain_filter.is_some()
                    && !result
                        .match_reasons
                        .iter()
                        .any(|reason| reason == match_reason::DOMAIN_HIT)
                {
                    result = result.with_match_reason(match_reason::DOMAIN_HIT);
                }
                if is_gate_session {
                    result = result.with_match_reason(match_reason::SUMMARY_HIT);
                }
                Some(result)
            })
            .take(limit)
            .collect();

        Ok(results)
    }

    async fn is_summary_gate_eligible_session(
        &self,
        tenant_id: &str,
        session_id: Uuid,
    ) -> Result<bool> {
        let summary_units = self
            .unit_repo
            .list_by_session_and_kind(tenant_id, session_id, MemoryUnitKind::Summary)
            .await?;
        let Some(latest_summary_unit) = summary_units.first() else {
            return Ok(false);
        };
        if latest_summary_unit.summary_state.summary_status != "ready" {
            return Ok(false);
        }

        Ok(latest_summary_unit
            .summary_state
            .summary
            .as_deref()
            .is_some_and(is_quality_summary))
    }
}

fn unique_session_ids(candidates: &[RetrieveResult]) -> Vec<Uuid> {
    candidates
        .iter()
        .filter_map(|candidate| Uuid::parse_str(&candidate.session_id).ok())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect()
}

fn is_quality_summary(summary: &str) -> bool {
    let normalized = summary.trim();
    if normalized.chars().count() < 24 {
        return false;
    }

    let lower = normalized.to_lowercase();
    ![
        "summary task already accepted",
        "accepted for session",
        "pending",
        "n/a",
        "todo",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Integration tests would require a test database.
    // For now, we verify the retriever structure compiles correctly.

    #[test]
    fn retriever_new_works() {
        // This is a compile-time check
        // Actual functionality requires a database connection
    }

    #[test]
    fn quality_summary_heuristic_works() {
        assert!(!is_quality_summary("summary task already accepted for session 123"));
        assert!(!is_quality_summary("todo"));
        assert!(is_quality_summary(
            "The user asked for rollout checklist details and follow-up milestones."
        ));
    }
}
