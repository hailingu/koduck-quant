//! LLM adapter gRPC client.
//!
//! Re-exports from the proto module for convenient access.
//! The orchestrator can use `LlmServiceClient<T>` directly.

pub use super::proto::LlmServiceClient;
pub use super::proto::{LlmService, LlmServiceServer};
