//! Kimi direct LLM provider adapter.

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

const KIMI_PROFILE: ProviderProfile = ProviderProfile {
    provider: "kimi",
    default_base_url: "https://api.kimi.com/coding/v1",
    models_path: "/models",
    chat_completions_path: "/chat/completions",
};

const KIMI_EXTRA_HEADERS: &[(&str, &str)] = &[
    ("User-Agent", "RooCode/3.52.0"),
    ("HTTP-Referer", "https://github.com/RooVetGit/Roo-Cline"),
    ("X-Title", "Roo Code"),
];

#[derive(Clone)]
pub struct KimiProvider {
    inner: OpenAiCompatibleProvider,
}

impl KimiProvider {
    pub fn new(
        api_key: impl Into<String>,
        base_url: Option<String>,
        default_model: impl Into<String>,
    ) -> Result<Self, AppError> {
        Ok(Self {
            inner: OpenAiCompatibleProvider::new_with_headers(
                KIMI_PROFILE,
                api_key.into(),
                base_url,
                default_model.into(),
                KIMI_EXTRA_HEADERS,
            )?,
        })
    }
}

fn resolve_kimi_model_alias(model: &str) -> String {
    if model.trim().eq_ignore_ascii_case("kimi-k2.5") {
        "kimi-for-coding".to_string()
    } else {
        model.to_string()
    }
}

#[async_trait]
impl LlmProvider for KimiProvider {
    async fn generate(&self, mut req: GenerateRequest) -> Result<GenerateResponse, AppError> {
        req.model = resolve_kimi_model_alias(&req.model);
        self.inner.generate_inner(req).await
    }

    async fn stream_generate(&self, mut req: GenerateRequest) -> Result<ProviderEventStream, AppError> {
        req.model = resolve_kimi_model_alias(&req.model);
        self.inner.stream_generate_inner(req).await
    }

    async fn list_models(&self, req: ListModelsRequest) -> Result<Vec<ModelInfo>, AppError> {
        self.inner.list_models_inner(req).await
    }

    async fn count_tokens(
        &self,
        mut req: CountTokensRequest,
    ) -> Result<CountTokensResponse, AppError> {
        req.model = resolve_kimi_model_alias(&req.model);
        self.inner.count_tokens_inner(req).await
    }
}
