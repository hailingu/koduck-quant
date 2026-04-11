//! LLM provider adapter and routing.

pub mod compat;
pub mod provider;
pub mod types;

pub use compat::AdapterLlmProvider;
pub use provider::{LlmProvider, ProviderEventStream};
pub use types::{
    ChatMessage, CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse,
    ListModelsRequest, ModelInfo, RequestContext, StreamEvent, TokenUsage, ToolDefinition,
};
