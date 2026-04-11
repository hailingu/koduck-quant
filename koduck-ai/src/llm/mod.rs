//! LLM provider adapter and routing.

pub mod compat;
pub mod errors;
pub mod http;
pub mod provider;
pub mod types;

pub use compat::AdapterLlmProvider;
pub use http::{JsonRequestOptions, LlmHttpClient, SseEvent, SseStreamParser};
pub use provider::{LlmProvider, ProviderEventStream};
pub use types::{
    ChatMessage, CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse,
    ListModelsRequest, ModelInfo, RequestContext, StreamEvent, TokenUsage, ToolDefinition,
};
