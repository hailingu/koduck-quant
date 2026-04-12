//! Retrieval strategies for memory queries.
//!
//! This module provides different retrieval strategies:
//! - DOMAIN_FIRST: Filter by domain_class first, then by session scope.
//! - SUMMARY_FIRST: Use summary for filtering (to be implemented in Task 5.3).

pub mod domain_first;
pub mod types;

pub use domain_first::DomainFirstRetriever;
pub use types::{
    domain_class, match_reason, RetrieveContext, RetrieveResult,
};
