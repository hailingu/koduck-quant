//! Memory service gRPC client.
//!
//! Re-exports from the proto module for convenient access.
//! The orchestrator can use `MemoryServiceClient<T>` directly.

pub use super::proto::MemoryServiceClient;
pub use super::proto::{MemoryService, MemoryServiceServer};
