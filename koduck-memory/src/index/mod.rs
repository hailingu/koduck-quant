//! L1 structured index material management for memory retrieval.
//!
//! This module provides data models and repository for `memory_index_records` table,
//! which stores structured L1 index material supporting:
//! - DOMAIN_FIRST retrieval strategy
//! - SUMMARY_FIRST retrieval strategy
//! - L0 raw material traceability via source_uri

pub mod model;
pub mod repository;

pub use model::{InsertMemoryIndexRecord, MemoryIndexRecord};
pub use repository::MemoryIndexRepository;
