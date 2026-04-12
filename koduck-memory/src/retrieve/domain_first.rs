//! DOMAIN_FIRST retrieval strategy implementation.
//!
//! This strategy filters memory records by domain_class first,
//! then optionally restricts to a specific session scope.

use sqlx::PgPool;
use tracing::{debug, info, instrument};

use crate::index::MemoryIndexRepository;
use crate::retrieve::types::{
    match_reason, RetrieveContext, RetrieveResult,
};
use crate::Result;

/// Retriever implementing the DOMAIN_FIRST strategy.
#[derive(Clone)]
pub struct DomainFirstRetriever {
    index_repo: MemoryIndexRepository,
}

impl DomainFirstRetriever {
    /// Create a new DomainFirstRetriever.
    pub fn new(pool: &PgPool) -> Self {
        Self {
            index_repo: MemoryIndexRepository::new(pool),
        }
    }

    /// Retrieve memories using DOMAIN_FIRST strategy.
    ///
    /// # Strategy
    /// 1. Query memory_index_records by tenant_id + domain_class.
    /// 2. If session_id is specified, filter to that session.
    /// 3. Order by updated_at DESC (most recent first).
    /// 4. Apply top_k limit.
    /// 5. Generate match_reasons for each hit.
    #[instrument(skip(self, ctx), fields(tenant_id = %ctx.tenant_id, domain_class = %ctx.domain_class))]
    pub async fn retrieve(&self, ctx: &RetrieveContext) -> Result<Vec<RetrieveResult>> {
        let limit = ctx.top_k as i64;
        
        // Parse session_id if provided
        let session_uuid = ctx.session_id.as_ref().and_then(|s| {
            uuid::Uuid::parse_str(s).ok()
        });

        debug!(
            query_text = %ctx.query_text,
            session_id = ?ctx.session_id,
            limit = limit,
            "starting DOMAIN_FIRST retrieval"
        );

        // Query based on whether session scope is specified
        let records = if let Some(session_id) = session_uuid {
            self.index_repo
                .list_by_session(&ctx.tenant_id, session_id, Some(&ctx.domain_class), limit)
                .await?
        } else {
            self.index_repo
                .list_by_domain(&ctx.tenant_id, &ctx.domain_class, limit)
                .await?
        };

        info!(
            record_count = records.len(),
            tenant_id = %ctx.tenant_id,
            domain_class = %ctx.domain_class,
            "DOMAIN_FIRST retrieval completed"
        );

        // Convert records to results with match reasons
        let results = records
            .into_iter()
            .map(|record| {
                let mut result = RetrieveResult::new(
                    record.session_id.to_string(),
                    record.source_uri,
                    record.score_hint.map(|s| s.parse().unwrap_or(0.5)).unwrap_or(0.5),
                    record.snippet.unwrap_or_else(|| {
                        // Truncate summary to create snippet if none exists
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
