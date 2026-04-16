use sqlx::PgPool;

use crate::Result;
use crate::retrieve::{AnchorFirstRetriever, RetrieveContext, RetrieveResult, SummaryFirstRetriever};

pub async fn retrieve_by_policy(
    pool: &PgPool,
    ctx: &RetrieveContext,
    retrieve_policy: i32,
) -> Result<Vec<RetrieveResult>> {
    match retrieve_policy {
        1 | 0 => {
            // DOMAIN_FIRST (1) or UNSPECIFIED (0) routes to internal ANCHOR_FIRST.
            let retriever = AnchorFirstRetriever::new(pool);
            retriever.retrieve(ctx).await
        }
        2 => {
            // SUMMARY_FIRST (2)
            let retriever = SummaryFirstRetriever::new(pool);
            retriever.retrieve(ctx).await
        }
        3 => {
            // HYBRID (3) - reserved for V2, fall back to internal ANCHOR_FIRST.
            tracing::warn!(
                policy = retrieve_policy,
                "HYBRID retrieval policy requested but not implemented in V1, falling back to ANCHOR_FIRST"
            );
            let retriever = AnchorFirstRetriever::new(pool);
            retriever.retrieve(ctx).await
        }
        _ => {
            // Other policies not yet implemented, fall back to internal ANCHOR_FIRST.
            tracing::warn!(
                policy = retrieve_policy,
                "Unknown retrieval policy requested, falling back to ANCHOR_FIRST"
            );
            let retriever = AnchorFirstRetriever::new(pool);
            retriever.retrieve(ctx).await
        }
    }
}
