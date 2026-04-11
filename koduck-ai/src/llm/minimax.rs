//! MiniMax direct LLM provider adapter.

use async_trait::async_trait;

use crate::reliability::error::AppError;

use super::{
    openai::{OpenAiCompatibleProvider, ProviderProfile},
    provider::{LlmProvider, ProviderEventStream},
    types::{
        CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse,
        ListModelsRequest, ModelInfo,
    },
};

const MINIMAX_PROFILE: ProviderProfile = ProviderProfile {
    provider: "minimax",
    default_base_url: "https://api.minimax.chat/v1",
    models_path: "/models",
    chat_completions_path: "/chat/completions",
};

#[derive(Clone)]
pub struct MiniMaxProvider {
    inner: OpenAiCompatibleProvider,
}

impl MiniMaxProvider {
    pub fn new(
        api_key: impl Into<String>,
        base_url: Option<String>,
        default_model: impl Into<String>,
    ) -> Result<Self, AppError> {
        Ok(Self {
            inner: OpenAiCompatibleProvider::new(
                MINIMAX_PROFILE,
                api_key.into(),
                base_url,
                default_model.into(),
            )?,
        })
    }
}

#[async_trait]
impl LlmProvider for MiniMaxProvider {
    async fn generate(&self, req: GenerateRequest) -> Result<GenerateResponse, AppError> {
        self.inner.generate_inner(req).await
    }

    async fn stream_generate(&self, req: GenerateRequest) -> Result<ProviderEventStream, AppError> {
        self.inner.stream_generate_inner(req).await
    }

    async fn list_models(&self, req: ListModelsRequest) -> Result<Vec<ModelInfo>, AppError> {
        self.inner.list_models_inner(req).await
    }

    async fn count_tokens(
        &self,
        req: CountTokensRequest,
    ) -> Result<CountTokensResponse, AppError> {
        self.inner.count_tokens_inner(req).await
    }
}
