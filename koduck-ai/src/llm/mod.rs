//! LLM provider adapter and routing.

pub mod compat;
pub mod deepseek;
pub mod errors;
pub mod http;
pub mod kimi;
pub mod minimax;
pub mod openai;
pub mod provider;
pub mod router;
pub mod types;

pub use compat::AdapterLlmProvider;
pub use deepseek::DeepSeekProvider;
pub use http::{JsonRequestOptions, LlmHttpClient, SseEvent, SseStreamParser};
pub use kimi::KimiProvider;
pub use minimax::MiniMaxProvider;
pub use openai::OpenAiProvider;
pub use provider::{LlmProvider, ProviderEventStream};
pub use router::{build_provider_router, LlmRouter};
pub use types::{
    ChatMessage, CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse,
    ListModelsRequest, ModelInfo, RequestContext, StreamEvent, TokenUsage, ToolCall,
    ToolDefinition,
};
