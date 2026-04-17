//! Retrieval strategies for memory queries.
//!
//! This module provides different retrieval strategies:
//! - ANCHOR_FIRST: Anchor-based retrieval over memory_unit_anchors.
//! - SUMMARY_FIRST: Summary text match within anchor candidates.

pub mod anchor_first;
pub mod policy;
pub mod query_analyzer;
pub mod semantics;
pub mod summary_first;
pub mod types;

pub use anchor_first::AnchorFirstRetriever;
pub use policy::retrieve_by_policy;
pub use query_analyzer::{QueryAnalysis, QueryAnalyzer};
pub use semantics::{
    DiscourseAction,
    QueryIntentType,
    infer_discourse_actions,
    map_intent_to_discourse_action,
    normalize_intent_aux,
};
pub use summary_first::SummaryFirstRetriever;
pub use types::{
    domain_class, match_reason, RetrieveContext, RetrieveResult,
};
