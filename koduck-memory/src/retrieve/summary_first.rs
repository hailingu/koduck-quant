//! SUMMARY_FIRST retrieval strategy implementation.
//!
//! This strategy performs two-stage retrieval:
//! 1. Filter by domain_class (using DomainFirstRetriever)
//! 2. Within candidates, match against summary using full-text search

use sqlx::PgPool;
use tracing::{debug, info, instrument};

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
        let domain_filter = (!ctx.domain_class.trim().is_empty()).then_some(ctx.domain_class.as_str());

        // If no query text, fall back to DOMAIN_FIRST
        if ctx.query_text.trim().is_empty() {
            debug!("empty query_text, falling back to DOMAIN_FIRST");
            return self.domain_retriever.retrieve(ctx).await;
        }

        let limit = ctx.top_k as i64;
        let session_uuid = ctx
            .session_id
            .as_ref()
            .and_then(|session_id| uuid::Uuid::parse_str(session_id).ok());

        // First collect the structural candidate set. When no explicit session scope is
        // provided, SUMMARY_FIRST should search across all historical summaries in the same
        // domain rather than silently collapsing back to the current session.
        let domain_records = if let Some(session_id) = session_uuid {
            self.index_repo
                .list_by_session(&ctx.tenant_id, session_id, domain_filter, limit * 4)
                .await?
        } else {
            match domain_filter {
                Some(domain_class) => {
                    self.index_repo
                        .list_by_domain(&ctx.tenant_id, domain_class, limit * 4)
                        .await?
                }
                None => Vec::new(),
            }
        };

        if domain_records.is_empty() {
            debug!("no domain candidates found for SUMMARY_FIRST");
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

        // Summary acts as a negative filter inside the domain candidate set:
        // only records that survive the summary check are returned.
        let results = domain_records
            .into_iter()
            .filter(|record| summary_match_ids.contains(&record.id))
            .take(limit as usize)
            .map(|record| {
                let mut result = RetrieveResult::new(
                    record.session_id.to_string(),
                    record.source_uri,
                    record
                        .score_hint
                        .as_deref()
                        .and_then(|score| score.parse().ok())
                        .unwrap_or(0.5),
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
                if domain_filter.is_some() {
                    result = result.with_match_reason(match_reason::DOMAIN_CLASS_HIT);
                }

                // Add summary_hit because the record survived summary filtering.
                result = result.with_match_reason(match_reason::SUMMARY_HIT);

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
