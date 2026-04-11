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
mod tests {
    use std::{collections::HashMap, sync::Arc};

    use async_trait::async_trait;
    use futures::stream;

    use crate::reliability::error::AppError;

    use super::{
        CountTokensRequest, CountTokensResponse, GenerateRequest, GenerateResponse, LlmProvider,
        ListModelsRequest, ModelInfo, ProviderEventStream, StreamEvent,
    };
    use crate::llm::types::{ChatMessage, RequestContext, TokenUsage};

    struct MockProvider;

    #[async_trait]
    impl LlmProvider for MockProvider {
        async fn generate(&self, req: GenerateRequest) -> Result<GenerateResponse, AppError> {
            Ok(GenerateResponse {
                provider: req.provider,
                model: req.model,
                message: req.messages.into_iter().next().unwrap(),
                finish_reason: "stop".to_string(),
                usage: Some(TokenUsage {
                    prompt_tokens: 1,
                    completion_tokens: 1,
                    total_tokens: 2,
                }),
            })
        }

        async fn stream_generate(
            &self,
            req: GenerateRequest,
        ) -> Result<ProviderEventStream, AppError> {
            Ok(Box::pin(stream::iter(vec![Ok(StreamEvent {
                provider: req.provider,
                model: req.model,
                event_id: "evt-1".to_string(),
                sequence_num: 1,
                delta: "hello".to_string(),
                finish_reason: String::new(),
                usage: None,
            })])))
        }

        async fn list_models(&self, req: ListModelsRequest) -> Result<Vec<ModelInfo>, AppError> {
            Ok(vec![ModelInfo {
                id: "mock-model".to_string(),
                provider: req.provider,
                display_name: "Mock Model".to_string(),
                max_context_tokens: 1024,
                max_output_tokens: 512,
                supports_streaming: true,
                supports_tools: false,
                supported_features: vec!["chat".to_string(), "stream".to_string()],
            }])
        }

        async fn count_tokens(
            &self,
            req: CountTokensRequest,
        ) -> Result<CountTokensResponse, AppError> {
            Ok(CountTokensResponse {
                provider: req.provider,
                model: req.model,
                total_tokens: req.messages.len() as u32,
            })
        }
    }

    fn sample_request() -> GenerateRequest {
        GenerateRequest {
            meta: RequestContext {
                request_id: "req-1".to_string(),
                session_id: "sess-1".to_string(),
                user_id: "user-1".to_string(),
                trace_id: "trace-1".to_string(),
                deadline_ms: 1000,
            },
            provider: "adapter".to_string(),
            model: "test-model".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "hi".to_string(),
                name: String::new(),
                metadata: HashMap::new(),
            }],
            temperature: 0.2,
            top_p: 1.0,
            max_tokens: 128,
            tools: vec![],
            response_format: String::new(),
        }
    }

    #[tokio::test]
    async fn trait_object_covers_generate_and_stream_paths() {
        let provider: Arc<dyn LlmProvider> = Arc::new(MockProvider);
        let response = provider.generate(sample_request()).await.unwrap();
        assert_eq!(response.message.content, "hi");

        let mut stream = provider.stream_generate(sample_request()).await.unwrap();
        let event = futures::StreamExt::next(&mut stream).await.unwrap().unwrap();
        assert_eq!(event.sequence_num, 1);
        assert_eq!(event.delta, "hello");
    }
}
