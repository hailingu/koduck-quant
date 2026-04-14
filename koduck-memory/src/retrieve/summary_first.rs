//! SUMMARY_FIRST retrieval strategy implementation.
//!
//! This strategy performs two-stage retrieval:
//! 1. Filter by domain_class (using DomainFirstRetriever)
//! 2. Within candidates, match against summary using full-text search

use sqlx::PgPool;
use tracing::{debug, info, instrument};

use crate::index::MemoryIndexRepository;
use crate::retrieve::anchor_first::AnchorFirstRetriever;
use crate::retrieve::types::{
    match_reason, RetrieveContext, RetrieveResult,
};
use crate::Result;

/// Retriever implementing the SUMMARY_FIRST strategy.
#[derive(Clone)]
pub struct SummaryFirstRetriever {
    anchor_retriever: AnchorFirstRetriever,
    index_repo: MemoryIndexRepository,
}

impl SummaryFirstRetriever {
    /// Create a new SummaryFirstRetriever.
    pub fn new(pool: &PgPool) -> Self {
        Self {
            anchor_retriever: AnchorFirstRetriever::new(pool),
            index_repo: MemoryIndexRepository::new(pool),
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

        let limit = ctx.top_k as i64;
        let session_uuid = ctx
            .session_id
            .as_ref()
            .and_then(|session_id| uuid::Uuid::parse_str(session_id).ok());

        let anchor_candidates = self.anchor_retriever.retrieve(ctx).await?;
        if anchor_candidates.is_empty() {
            debug!("no anchor candidates found for SUMMARY_FIRST");
            return Ok(Vec::new());
        }

        // Perform summary search
        let summary_records = self
            .index_repo
            .search_by_summary_in_scope(
                &ctx.tenant_id,
                session_uuid,
                domain_filter.unwrap_or(""),
                &ctx.query_text,
                limit * 2,
            )
            .await?;

        debug!(
            summary_match_count = summary_records.len(),
            query_text = %ctx.query_text,
            "summary search completed"
        );

        // If no summary matches, return no hits rather than falling back to unrelated
        // domain-only candidates. This keeps summary retrieval semantically meaningful.
        if summary_records.is_empty() {
            info!(
                query_text = %ctx.query_text,
                "no summary matches found for SUMMARY_FIRST"
            );
            return Ok(Vec::new());
        }

        info!(
            anchor_count = anchor_candidates.len(),
            summary_match_count = summary_records.len(),
            tenant_id = %ctx.tenant_id,
            "SUMMARY_FIRST retrieval completed"
        );

        // Build a set of record IDs that matched summary
        let summary_match_sources: std::collections::HashSet<_> = summary_records
            .iter()
            .map(|r| r.source_uri.clone())
            .collect();

        // Summary acts as a negative filter inside the domain candidate set:
        // only records that survive the summary check are returned.
        let results = anchor_candidates
            .into_iter()
            .filter(|record| summary_match_sources.contains(&record.l0_uri))
            .take(limit as usize)
            .map(|record| {
                let mut result = record;
                if domain_filter.is_some()
                    && !result
                        .match_reasons
                        .iter()
                        .any(|reason| reason == match_reason::DOMAIN_HIT)
                {
                    result = result.with_match_reason(match_reason::DOMAIN_HIT);
                }
                result.with_match_reason(match_reason::SUMMARY_HIT)
            })
            .collect();

        Ok(results)
    }
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
}
