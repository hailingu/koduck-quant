//! Tool service gRPC client.
//!
//! Re-exports from the proto module for convenient access.
//! The orchestrator can use `ToolServiceClient<T>` directly.

pub use super::proto::ToolServiceClient;
pub use super::proto::{ToolService, ToolServiceServer};
