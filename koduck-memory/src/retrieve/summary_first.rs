//! SUMMARY_FIRST retrieval strategy implementation.
//!
//! This strategy performs two-stage retrieval:
//! 1. Filter by domain_class (using DomainFirstRetriever)
//! 2. Within candidates, match against summary using full-text search

use sqlx::PgPool;
use tracing::{debug, info, instrument, warn};

use crate::index::MemoryIndexRepository;
use crate::retrieve::domain_first::DomainFirstRetriever;
use crate::retrieve::types::{
    match_reason, RetrieveContext, RetrieveResult,
};
use crate::Result;

/// Retriever implementing the SUMMARY_FIRST strategy.
#[derive(Clone)]
pub struct SummaryFirstRetriever {
    domain_retriever: DomainFirstRetriever,
    index_repo: MemoryIndexRepository,
}

impl SummaryFirstRetriever {
    /// Create a new SummaryFirstRetriever.
    pub fn new(pool: &PgPool) -> Self {
        Self {
            domain_retriever: DomainFirstRetriever::new(pool),
            index_repo: MemoryIndexRepository::new(pool),
        }
    }

    /// Retrieve memories using SUMMARY_FIRST strategy.
    ///
    /// # Strategy
    /// 1. First, get candidates using DOMAIN_FIRST strategy.
    /// 2. If query_text is provided, perform full-text search on summary.
    /// 3. Mark records with summary_hit if they match the query.
    /// 4. Return combined results with appropriate match_reasons.
    #[instrument(skip(self, ctx), fields(tenant_id = %ctx.tenant_id, domain_class = %ctx.domain_class))]
    pub async fn retrieve(&self, ctx: &RetrieveContext) -> Result<Vec<RetrieveResult>> {
        // If no query text, fall back to DOMAIN_FIRST
        if ctx.query_text.trim().is_empty() {
            debug!("empty query_text, falling back to DOMAIN_FIRST");
            return self.domain_retriever.retrieve(ctx).await;
        }

        let limit = ctx.top_k as i64;

        // Perform summary search
        let summary_records = self
            .index_repo
            .search_by_summary(&ctx.tenant_id, &ctx.domain_class, &ctx.query_text, limit)
            .await?;

        debug!(
            summary_match_count = summary_records.len(),
            query_text = %ctx.query_text,
            "summary search completed"
        );

        // If no summary matches, fall back to DOMAIN_FIRST
        if summary_records.is_empty() {
            warn!(
                query_text = %ctx.query_text,
                "no summary matches found, falling back to DOMAIN_FIRST"
            );
            return self.domain_retriever.retrieve(ctx).await;
        }

        // Get all domain candidates for context
        let domain_records = self
            .index_repo
            .list_by_domain(&ctx.tenant_id, &ctx.domain_class, limit * 2)
            .await?;

        info!(
            domain_count = domain_records.len(),
            summary_match_count = summary_records.len(),
            tenant_id = %ctx.tenant_id,
            "SUMMARY_FIRST retrieval completed"
        );

        // Build a set of record IDs that matched summary
        let summary_match_ids: std::collections::HashSet<_> = summary_records
            .iter()
            .map(|r| r.id)
            .collect();

        // Convert domain records to results, marking summary_hit for matches
        let results = domain_records
            .into_iter()
            .take(limit as usize)
            .map(|record| {
                let is_summary_match = summary_match_ids.contains(&record.id);

                let mut result = RetrieveResult::new(
                    record.session_id.to_string(),
                    record.source_uri,
                    if is_summary_match { 0.8 } else { 0.5 },
                    record.snippet.unwrap_or_else(|| {
                        let summary = record.summary;
                        if summary.len() > 200 {
                            format!("{}...", &summary[..200])
                        } else {
                            summary
                        }
                    }),
                );

                // Add domain_class_hit reason
                result = result.with_match_reason(match_reason::DOMAIN_CLASS_HIT);

                // Add summary_hit if this record matched the summary search
                if is_summary_match {
                    result = result.with_match_reason(match_reason::SUMMARY_HIT);
                }

                // Add session_scope_hit if session filter was applied
                if ctx.session_id.is_some() {
                    result = result.with_match_reason(match_reason::SESSION_SCOPE_HIT);
                }

                result
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
