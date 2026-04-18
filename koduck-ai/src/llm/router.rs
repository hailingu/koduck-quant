//! Provider selection and mode switch for direct vs adapter-backed LLM traffic.

use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};

use async_trait::async_trait;

use crate::{
    config::{Config, LlmMode},
    reliability::error::{AppError, ErrorCode},
};

use super::{
    compat::AdapterLlmProvider,
    deepseek::DeepSeekProvider,
    kimi::KimiProvider,
    minimax::MiniMaxProvider,
    openai::OpenAiProvider,
    provider::{LlmProvider, ProviderEventStream},
    types::{
        CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse, ListModelsRequest,
        ModelInfo,
    },
};

pub fn build_provider_router(config: &Config) -> Result<Arc<dyn LlmProvider>, AppError> {
    Ok(Arc::new(LlmRouter::from_config(config)?))
}

pub struct LlmRouter {
    mode: LlmMode,
    default_provider: String,
    enabled_providers: HashSet<String>,
    direct_providers: HashMap<String, Arc<dyn LlmProvider>>,
    adapter_provider: Arc<dyn LlmProvider>,
}

impl LlmRouter {
    pub fn from_config(config: &Config) -> Result<Self, AppError> {
        let adapter_provider: Arc<dyn LlmProvider> =
            Arc::new(AdapterLlmProvider::new(config.llm.adapter_grpc_target.clone()));
        let mut direct_providers: HashMap<String, Arc<dyn LlmProvider>> = HashMap::new();
        let mut enabled_providers: HashSet<String> = HashSet::new();

        if config.llm.openai.enabled {
            enabled_providers.insert("openai".to_string());
            if let Some(api_key) = config.openai_api_key().filter(|key| !key.trim().is_empty()) {
                direct_providers.insert(
                    "openai".to_string(),
                    Arc::new(OpenAiProvider::new(
                        api_key.to_string(),
                        Some(config.llm.openai.base_url.clone()),
                        config.llm.openai.default_model.clone(),
                    )?),
                );
            }
        }

        if config.llm.deepseek.enabled {
            enabled_providers.insert("deepseek".to_string());
            if let Some(api_key) = config.deepseek_api_key().filter(|key| !key.trim().is_empty()) {
                direct_providers.insert(
                    "deepseek".to_string(),
                    Arc::new(DeepSeekProvider::new(
                        api_key.to_string(),
                        Some(config.llm.deepseek.base_url.clone()),
                        config.llm.deepseek.default_model.clone(),
                    )?),
                );
            }
        }

        if config.llm.minimax.enabled {
            enabled_providers.insert("minimax".to_string());
            if let Some(api_key) = config.minimax_api_key().filter(|key| !key.trim().is_empty()) {
                direct_providers.insert(
                    "minimax".to_string(),
                    Arc::new(MiniMaxProvider::new(
                        api_key.to_string(),
                        Some(config.llm.minimax.base_url.clone()),
                        config.llm.minimax.default_model.clone(),
                    )?),
                );
            }
        }
        if config.llm.kimi.enabled {
            enabled_providers.insert("kimi".to_string());
            if let Some(api_key) = config.kimi_api_key().filter(|key| !key.trim().is_empty()) {
                direct_providers.insert(
                    "kimi".to_string(),
                    Arc::new(KimiProvider::new(
                        api_key.to_string(),
                        Some(config.llm.kimi.base_url.clone()),
                        config.llm.kimi.default_model.clone(),
                    )?),
                );
            }
        }

        Ok(Self {
            mode: config.llm.mode,
            default_provider: config.llm.default_provider.clone(),
            enabled_providers,
            direct_providers,
            adapter_provider,
        })
    }

    fn resolve_route(&self, provider: &str, model: &str) -> Result<ResolvedRoute, AppError> {
        let (parsed_provider, parsed_model) = parse_provider_model(provider, model);
        let provider = parsed_provider.unwrap_or_else(|| self.default_provider.clone());
        let model = parsed_model.unwrap_or_else(|| model.to_string());

        match self.mode {
            LlmMode::Adapter => Ok(ResolvedRoute {
                provider,
                model,
                target: Arc::clone(&self.adapter_provider),
            }),
            LlmMode::Direct => {
                if !self.enabled_providers.contains(&provider) {
                    return Err(AppError::new(
                        ErrorCode::InvalidArgument,
                        format!(
                            "llm provider '{}' is not enabled for direct mode; no implicit fallback will be applied",
                            provider
                        ),
                    ));
                }
                let target = self.direct_providers.get(&provider).ok_or_else(|| {
                    AppError::new(
                        ErrorCode::InvalidArgument,
                        format!(
                            "llm provider '{}' is enabled for direct mode but missing runtime credentials; no implicit fallback will be applied",
                            provider
                        ),
                    )
                })?;
                Ok(ResolvedRoute {
                    provider,
                    model,
                    target: Arc::clone(target),
                })
            }
        }
    }
}

#[async_trait]
impl LlmProvider for LlmRouter {
    async fn generate(&self, mut req: GenerateRequest) -> Result<GenerateResponse, AppError> {
        let route = self.resolve_route(&req.provider, &req.model)?;
        req.provider = route.provider;
        req.model = route.model;
        route.target.generate(req).await
    }

    async fn stream_generate(&self, mut req: GenerateRequest) -> Result<ProviderEventStream, AppError> {
        let route = self.resolve_route(&req.provider, &req.model)?;
        req.provider = route.provider;
        req.model = route.model;
        route.target.stream_generate(req).await
    }

    async fn list_models(&self, mut req: ListModelsRequest) -> Result<Vec<ModelInfo>, AppError> {
        let route = self.resolve_route(&req.provider, "")?;
        req.provider = route.provider;
        route.target.list_models(req).await
    }

    async fn count_tokens(
        &self,
        mut req: CountTokensRequest,
    ) -> Result<CountTokensResponse, AppError> {
        let route = self.resolve_route(&req.provider, &req.model)?;
        req.provider = route.provider;
        req.model = route.model;
        route.target.count_tokens(req).await
    }
}

struct ResolvedRoute {
    provider: String,
    model: String,
    target: Arc<dyn LlmProvider>,
}

fn parse_provider_model(provider: &str, model: &str) -> (Option<String>, Option<String>) {
    if !provider.trim().is_empty() {
        return (Some(provider.trim().to_ascii_lowercase()), normalized_model(model));
    }

    let model = model.trim();
    if let Some((provider, rest)) = model.split_once(':') {
        return (
            Some(provider.trim().to_ascii_lowercase()),
            normalized_model(rest),
        );
    }
    if let Some((provider, rest)) = model.split_once('/') {
        if matches!(
            provider.trim().to_ascii_lowercase().as_str(),
            "openai" | "deepseek" | "minimax" | "kimi"
        ) {
            return (
                Some(provider.trim().to_ascii_lowercase()),
                normalized_model(rest),
            );
        }
    }

    (None, normalized_model(model))
}

fn normalized_model(model: &str) -> Option<String> {
    let model = model.trim();
    (!model.is_empty()).then(|| model.to_string())
}

#[cfg(test)]
#[path = "../tests/llm/router_tests.rs"]
mod tests;
