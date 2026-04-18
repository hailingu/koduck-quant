//! Provider abstraction shared by direct and adapter-backed LLM integrations.

use std::pin::Pin;

use async_trait::async_trait;
use futures::Stream;

use crate::reliability::error::AppError;

use super::types::{
    CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse, ListModelsRequest,
    ModelInfo, StreamEvent,
};

pub type ProviderEventStream =
    Pin<Box<dyn Stream<Item = Result<StreamEvent, AppError>> + Send + 'static>>;

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn generate(&self, req: GenerateRequest) -> Result<GenerateResponse, AppError>;

    async fn stream_generate(&self, req: GenerateRequest) -> Result<ProviderEventStream, AppError>;

    async fn list_models(&self, req: ListModelsRequest) -> Result<Vec<ModelInfo>, AppError>;

    async fn count_tokens(
        &self,
        req: CountTokensRequest,
    ) -> Result<CountTokensResponse, AppError>;
}

#[cfg(test)]
#[path = "../tests/llm/provider_tests.rs"]
mod tests;
