//! Retrieval strategies for memory queries.
//!
//! This module provides different retrieval strategies:
//! - DOMAIN_FIRST: Filter by domain_class first, then by session scope.
//! - SUMMARY_FIRST: Use summary for filtering within domain_class candidates.

pub mod domain_first;
pub mod query_analyzer;
pub mod summary_first;
pub mod types;

pub use domain_first::DomainFirstRetriever;
pub use query_analyzer::{QueryAnalysis, QueryAnalyzer};
pub use summary_first::SummaryFirstRetriever;
pub use types::{
    domain_class, match_reason, RetrieveContext, RetrieveResult,
};
