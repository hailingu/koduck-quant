use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;

use tonic::{Request, Response, Status};
use tracing::info;

use super::append_builder;
use super::query_memory_hits;
use super::request_meta;
use super::response_helpers;
use super::rpc_helpers;
use super::session_lookup;
use crate::api::{
    AppendMemoryRequest, AppendMemoryResponse, Capability, DeleteMemoryEntryRequest,
    DeleteMemoryEntryResponse, DeleteSessionRequest, DeleteSessionResponse,
    GetAllSessionIdsRequest,
    GetCategoryCatalogRequest, GetCategoryCatalogResponse, GetSessionRequest,
    GetSessionIdsByDomainClassRequest, GetSessionIdsByIntentTypeRequest,
    GetSessionIdsByNerRequest, GetSessionIdsLookupResponse, GetSessionResponse,
    GetSessionSummaryRequest, GetSessionSummaryResponse, GetSessionTranscriptRequest,
    GetSessionTranscriptResponse, MemoryService,
    QueryMemoryRequest, QueryMemoryResponse, RequestMeta, SessionTranscriptEntry,
    SummarizeMemoryRequest, SummarizeMemoryResponse, UpsertSessionMetaRequest,
    UpsertSessionMetaResponse,
};
use crate::api::proto::memory::QueryIntent;
use crate::config::AppConfig;
use crate::facts::MemoryFactRepository;
use crate::memory::{IdempotencyRepository, MemoryEntryRepository};
use crate::memory_anchor::MemoryUnitAnchorRepository;
use crate::memory_unit::{MemoryUnitMaterializer, MemoryUnitRepository};
use crate::summary::{MemorySummaryRepository, SummaryJob, SummaryTaskRunner};
use crate::observe::{record_rpc_call, RpcMethod, RpcOutcome};
use crate::observe::RpcGuard;
use crate::observe::RpcMetrics;
use crate::retrieve::{
    QueryAnalysis,
    QueryAnalyzer,
    QueryIntentType,
    RetrieveContext,
    match_reason,
    retrieve_by_policy,
};
use crate::session::{
    extra_to_jsonb, parse_optional_uuid, parse_uuid, SessionRepository, UpsertSession,
};
use crate::store::{ObjectStoreClient, RuntimeState};

const MAX_TOP_K: i32 = 20;
const MAX_PAGE_SIZE: i32 = 100;
const RECOMMENDED_TIMEOUT_MS: i64 = 5000;

struct ReplayedTranscript {
    entries: Vec<SessionTranscriptEntry>,
    transcript_text: String,
}

enum ReplayTranscriptError {
    RawContentUnavailable(&'static str),
    Internal(String),
}

#[derive(Clone)]
pub struct MemoryGrpcService {
    config: AppConfig,
    runtime: RuntimeState,
    object_store: Option<ObjectStoreClient>,
    rpc_metrics: Arc<RpcMetrics>,
}

impl MemoryGrpcService {
    pub fn new(
        config: AppConfig,
        runtime: RuntimeState,
        object_store: Option<ObjectStoreClient>,
        rpc_metrics: Arc<RpcMetrics>,
    ) -> Self {
        Self {
            config,
            runtime,
            object_store,
            rpc_metrics,
        }
    }

    fn session_repo(&self) -> SessionRepository {
        SessionRepository::new(self.runtime.pool())
    }

    fn entry_repo(&self) -> MemoryEntryRepository {
        MemoryEntryRepository::new(self.runtime.pool())
    }

    fn fact_repo(&self) -> MemoryFactRepository {
        MemoryFactRepository::new(self.runtime.pool())
    }

    fn anchor_repo(&self) -> MemoryUnitAnchorRepository {
        MemoryUnitAnchorRepository::new(self.runtime.pool())
    }

    fn unit_repo(&self) -> MemoryUnitRepository {
        MemoryUnitRepository::new(self.runtime.pool())
    }

    fn summary_repo(&self) -> MemorySummaryRepository {
        MemorySummaryRepository::new(self.runtime.pool())
    }

    fn idempotency_repo(&self) -> IdempotencyRepository {
        IdempotencyRepository::new(self.runtime.pool())
    }

    async fn rebuild_session_units(
        &self,
        tenant_id: &str,
        session_id: uuid::Uuid,
    ) -> Result<usize, Status> {
        let remaining_entries = self
            .entry_repo()
            .list_by_session_ordered(tenant_id, session_id)
            .await
            .map_err(|error| Status::internal(format!("failed to list remaining entries: {error}")))?;

        if remaining_entries.is_empty() {
            return Ok(0);
        }

        let mut units = Vec::with_capacity(remaining_entries.len());
        for entry in remaining_entries {
            let content = if let Some(object_store) = self.object_store.as_ref() {
                if entry.l0_uri.starts_with("l0://pending/") {
                    String::new()
                } else {
                    object_store
                        .get_l0_entry(&entry.l0_uri)
                        .await
                        .map(|value| value.content)
                        .unwrap_or_default()
                }
            } else {
                String::new()
            };

            units.push(crate::memory_unit::AppendedEntryUnit {
                entry_id: entry.id,
                tenant_id: entry.tenant_id,
                session_id: entry.session_id,
                sequence_num: entry.sequence_num,
                content,
                source_uri: entry.l0_uri,
                message_ts: entry.message_ts,
            });
        }

        MemoryUnitMaterializer::new(self.runtime.pool())
            .materialize_appended_entries(&units)
            .await
            .map_err(|error| Status::internal(format!("failed to rebuild session units: {error}")))?;

        Ok(units.len())
    }

    fn spawn_summary_refresh(
        &self,
        tenant_id: String,
        session_id: uuid::Uuid,
        request_id: String,
    ) {
        let runner = SummaryTaskRunner::new(
            self.runtime.pool(),
            self.object_store.clone(),
            self.config.summary.clone(),
            self.config.retry.clone(),
        );
        let job = SummaryJob::new(tenant_id, session_id, "session-rollup", request_id);
        tokio::spawn(async move {
            if let Err(error) = runner.run(job.clone()).await {
                tracing::warn!(
                    error = %error,
                    session_id = %job.session_id,
                    "summary task failed after memory entry deletion"
                );
            }
        });
    }

    async fn replay_session_transcript(
        &self,
        tenant_id: &str,
        session_id: uuid::Uuid,
    ) -> Result<Option<ReplayedTranscript>, ReplayTranscriptError> {
        let entries = self
            .entry_repo()
            .list_by_session_ordered(tenant_id, session_id)
            .await
            .map_err(|error| ReplayTranscriptError::Internal(error.to_string()))?;

        if entries.is_empty() {
            return Ok(None);
        }

        let object_store = self
            .object_store
            .as_ref()
            .ok_or(ReplayTranscriptError::RawContentUnavailable(
                "object store is not configured for transcript replay",
            ))?;

        let mut transcript_entries = Vec::with_capacity(entries.len());
        for entry in entries {
            if entry.l0_uri.starts_with("l0://pending/") {
                return Err(ReplayTranscriptError::RawContentUnavailable(
                    "session raw content is not available in object store",
                ));
            }

            let l0 = object_store
                .get_l0_entry(&entry.l0_uri)
                .await
                .map_err(|error| ReplayTranscriptError::Internal(error.to_string()))?;

            transcript_entries.push(SessionTranscriptEntry {
                entry_id: entry.id.to_string(),
                role: l0.role.clone(),
                content: l0.content.clone(),
                timestamp: l0.timestamp,
                sequence_num: entry.sequence_num,
                metadata: l0
                    .metadata
                    .as_ref()
                    .and_then(|value| value.as_object())
                    .map(|object| {
                        object
                            .iter()
                            .map(|(key, value)| {
                                let rendered = value
                                    .as_str()
                                    .map_or_else(|| value.to_string(), ToString::to_string);
                                (key.clone(), rendered)
                            })
                            .collect()
                    })
                    .unwrap_or_default(),
                l0_uri: entry.l0_uri,
            });
        }

        let transcript_text = transcript_entries
            .iter()
            .map(|entry| format!("{}: {}", entry.role, entry.content))
            .collect::<Vec<_>>()
            .join("\n");

        Ok(Some(ReplayedTranscript {
            entries: transcript_entries,
            transcript_text,
        }))
    }

    async fn load_session_transcript_for_query_memory(
        &self,
        tenant_id: &str,
        session_id: &str,
    ) -> Option<String> {
        let session_uuid = match parse_uuid(session_id) {
            Ok(value) => value,
            Err(error) => {
                tracing::warn!(
                    session_id,
                    error = %error,
                    "query_memory transcript hydration skipped because session_id is invalid"
                );
                return None;
            }
        };

        match self.replay_session_transcript(tenant_id, session_uuid).await {
            Ok(Some(transcript)) => {
                if transcript.transcript_text.trim().is_empty() {
                    None
                } else {
                    Some(transcript.transcript_text)
                }
            }
            Ok(None) => None,
            Err(ReplayTranscriptError::RawContentUnavailable(error_message)) => {
                tracing::warn!(
                    session_id,
                    error = error_message,
                    "query_memory transcript hydration skipped because raw content is unavailable"
                );
                None
            }
            Err(ReplayTranscriptError::Internal(error)) => {
                tracing::warn!(
                    session_id,
                    tenant_id,
                    error = %error,
                    "query_memory transcript hydration skipped because transcript replay failed"
                );
                None
            }
        }
    }

    fn capability_response(&self) -> Capability {
        let mut features = HashMap::new();
        features.insert("session_meta".to_string(), "true".to_string());
        features.insert("category_catalog".to_string(), "true".to_string());
        features.insert("session_transcript".to_string(), "true".to_string());
        features.insert("query_memory".to_string(), "true".to_string());
        features.insert("append_memory".to_string(), "true".to_string());
        features.insert("summary".to_string(), "true".to_string());
        features.insert("domain_first_search".to_string(), "true".to_string());
        features.insert("summary_search".to_string(), "true".to_string());
        features.insert("append_mode".to_string(), "object_per_append".to_string());
        features.insert(
            "l0_storage".to_string(),
            if self.object_store.is_some() {
                "enabled".to_string()
            } else {
                "disabled".to_string()
            },
        );
        features.insert(
            "retrieve_policy.default".to_string(),
            self.config.index.mode.clone(),
        );
        features.insert(
            "summary_async".to_string(),
            self.config.summary.async_enabled.to_string(),
        );

        let mut limits = HashMap::new();
        limits.insert("max_top_k".to_string(), MAX_TOP_K.to_string());
        limits.insert("max_page_size".to_string(), MAX_PAGE_SIZE.to_string());
        limits.insert(
            "recommended_timeout_ms".to_string(),
            RECOMMENDED_TIMEOUT_MS.to_string(),
        );
        limits.insert(
            "capabilities_ttl_secs".to_string(),
            self.config.capabilities.ttl_secs.to_string(),
        );

        Capability {
            service: "memory".to_string(),
            contract_versions: vec!["memory.v1".to_string()],
            features,
            limits,
        }
    }

    fn explicit_query_intent(intent: i32) -> Option<QueryIntentType> {
        match QueryIntent::try_from(intent).ok()? {
            QueryIntent::Recall => Some(QueryIntentType::Recall),
            QueryIntent::Compare => Some(QueryIntentType::Compare),
            QueryIntent::Disambiguate => Some(QueryIntentType::Disambiguate),
            QueryIntent::Correct => Some(QueryIntentType::Correct),
            QueryIntent::Explain => Some(QueryIntentType::Explain),
            QueryIntent::Decide => Some(QueryIntentType::Decide),
            QueryIntent::Delete => None,
            QueryIntent::None => Some(QueryIntentType::None),
            QueryIntent::Unspecified => None,
        }
    }

    async fn retrieve_global_session_summaries(
        &self,
        tenant_id: &str,
        top_k: i32,
    ) -> Result<Vec<crate::api::MemoryHit>, Status> {
        let units = self
            .unit_repo()
            .list_recent_summary_units(tenant_id, top_k.max(1) as i64)
            .await
            .map_err(|e| Status::internal(format!("global summary retrieval failed: {e}")))?;

        let mut hits = Vec::new();
        let mut seen_sessions: HashSet<String> = HashSet::new();

        for unit in units {
            let session_id = unit.session_id.to_string();
            if !seen_sessions.insert(session_id.clone()) {
                continue;
            }

            let Some(transcript) = self
                .load_session_transcript_for_query_memory(tenant_id, &session_id)
                .await
            else {
                tracing::warn!(
                    tenant_id,
                    session_id,
                    "recall_global_summaries dropped hit because session transcript hydration failed"
                );
                continue;
            };

            hits.push(crate::api::MemoryHit {
                session_id,
                l0_uri: unit.source_uri,
                score: 1.0,
                match_reasons: vec![
                    match_reason::SUMMARY_HIT.to_string(),
                    match_reason::RECENCY_BOOST.to_string(),
                ],
                snippet: transcript,
            });
        }

        Ok(hits)
    }
}

#[tonic::async_trait]
impl MemoryService for MemoryGrpcService {
    async fn get_capabilities(
        &self,
        request: Request<RequestMeta>,
    ) -> Result<Response<Capability>, Status> {
        request_meta::validate_meta(request.get_ref())?;
        Ok(Response::new(self.capability_response()))
    }

    async fn get_category_catalog(
        &self,
        request: Request<GetCategoryCatalogRequest>,
    ) -> Result<Response<GetCategoryCatalogResponse>, Status> {
        let req = request.get_ref();
        request_meta::read_meta(req.meta.as_ref())?;

        Ok(Response::new(GetCategoryCatalogResponse {
            ok: true,
            domain_categories: crate::retrieve::domain_class::ALL
                .iter()
                .map(|value| value.to_string())
                .collect(),
            ner_categories: vec![
                "person".to_string(),
                "preference".to_string(),
                "constraint".to_string(),
                "task_context".to_string(),
                "session_focus".to_string(),
                "fact".to_string(),
            ],
            intent_categories: vec![
                QueryIntentType::Recall.as_str().to_string(),
                QueryIntentType::Compare.as_str().to_string(),
                QueryIntentType::Disambiguate.as_str().to_string(),
                QueryIntentType::Correct.as_str().to_string(),
                QueryIntentType::Explain.as_str().to_string(),
                QueryIntentType::Decide.as_str().to_string(),
                QueryIntentType::None.as_str().to_string(),
            ],
            error: None,
        }))
    }

    async fn upsert_session_meta(
        &self,
        request: Request<UpsertSessionMetaRequest>,
    ) -> Result<Response<UpsertSessionMetaResponse>, Status> {
        let req = request.get_ref();
        let meta = request_meta::read_write_meta(req.meta.as_ref())?;

        let session_id =
            parse_uuid(&req.session_id)
                .map_err(|e| Status::invalid_argument(format!("invalid session_id: {e}")))?;

        let last_message_at = if req.last_message_at > 0 {
            chrono::DateTime::from_timestamp_millis(req.last_message_at)
                .ok_or_else(|| Status::invalid_argument("invalid last_message_at"))?
        } else {
            chrono::Utc::now()
        };

        let upsert = UpsertSession {
            session_id,
            tenant_id: meta.tenant_id.clone(),
            user_id: meta.user_id.clone(),
            parent_session_id: parse_optional_uuid(&req.parent_session_id),
            forked_from_session_id: parse_optional_uuid(&req.forked_from_session_id),
            title: if req.title.is_empty() {
                "untitled".to_string()
            } else {
                req.title.clone()
            },
            status: if req.status.is_empty() {
                "active".to_string()
            } else {
                req.status.clone()
            },
            last_message_at,
            extra: extra_to_jsonb(&req.extra),
        };

        self.session_repo()
            .upsert(&upsert)
            .await
            .map_err(|e| Status::internal(format!("failed to upsert session: {e}")))?;

        Ok(response_helpers::ok_upsert_session_meta())
    }

    async fn get_session(
        &self,
        request: Request<GetSessionRequest>,
    ) -> Result<Response<GetSessionResponse>, Status> {
        let started_at = Instant::now();
        let mut guard = RpcGuard::new(&self.rpc_metrics, "get_session");
        let req = request.get_ref();
        let meta = request_meta::read_meta_with_guard(req.meta.as_ref(), &mut guard)?;

        let session_id =
            parse_uuid(&req.session_id).map_err(|e| { guard.error(); Status::invalid_argument(format!("invalid session_id: {e}")) })?;

        let result = match self
            .session_repo()
            .get_by_id(&meta.tenant_id, session_id)
            .await
            .map_err(|e| { guard.error(); Status::internal(format!("failed to get session: {e}")) })?
        {
            Some(session) => Ok(response_helpers::ok_get_session(session.to_proto())),
            None => Ok(response_helpers::session_not_found()),
        };

        let elapsed = started_at.elapsed();
        let duration_ms = elapsed.as_millis() as u64;
        match &result {
            Ok(response) if response.get_ref().ok => {
                record_rpc_call(RpcMethod::GetSession, RpcOutcome::Success, elapsed);
                rpc_helpers::log_rpc_completion(
                    "GetSession",
                    &meta.request_id,
                    &req.session_id,
                    &meta.tenant_id,
                    &meta.trace_id,
                    "success",
                    duration_ms,
                    "session_found=true",
                );
            }
            Ok(_) => {
                record_rpc_call(RpcMethod::GetSession, RpcOutcome::NotFound, elapsed);
                rpc_helpers::log_rpc_completion(
                    "GetSession",
                    &meta.request_id,
                    &req.session_id,
                    &meta.tenant_id,
                    &meta.trace_id,
                    "not_found",
                    duration_ms,
                    "session_found=false",
                );
            }
            Err(status) => {
                record_rpc_call(RpcMethod::GetSession, RpcOutcome::Error, elapsed);
                rpc_helpers::log_rpc_failure(
                    "GetSession",
                    &meta.request_id,
                    &req.session_id,
                    &meta.tenant_id,
                    &meta.trace_id,
                    duration_ms,
                    status,
                );
            }
        }

        result
    }

    async fn get_session_transcript(
        &self,
        request: Request<GetSessionTranscriptRequest>,
    ) -> Result<Response<GetSessionTranscriptResponse>, Status> {
        let started_at = Instant::now();
        let mut guard = RpcGuard::new(&self.rpc_metrics, "get_session_transcript");
        let req = request.get_ref();
        let meta = request_meta::read_meta_with_guard(req.meta.as_ref(), &mut guard)?;

        let session_id = parse_uuid(&req.session_id).map_err(|e| {
            guard.error();
            Status::invalid_argument(format!("invalid session_id: {e}"))
        })?;

        let session_exists = self
            .session_repo()
            .get_by_id(&meta.tenant_id, session_id)
            .await
            .map_err(|e| {
                guard.error();
                Status::internal(format!("failed to get session: {e}"))
            })?;

        let result = match session_exists {
            None => Ok(response_helpers::session_transcript_not_found()),
            Some(_) => {
                match self
                    .replay_session_transcript(&meta.tenant_id, session_id)
                    .await
                {
                    Ok(Some(transcript)) => Ok(response_helpers::ok_session_transcript(
                        transcript.entries,
                        transcript.transcript_text,
                    )),
                    Ok(None) => Ok(response_helpers::ok_session_transcript(
                        Vec::new(),
                        String::new(),
                    )),
                    Err(ReplayTranscriptError::RawContentUnavailable(message)) => Ok(
                        response_helpers::session_transcript_raw_unavailable(message.to_string()),
                    ),
                    Err(ReplayTranscriptError::Internal(error)) => {
                        guard.error();
                        Err(Status::internal(format!("failed to replay session transcript: {error}")))
                    }
                }
            }
        };

        let elapsed = started_at.elapsed();
        let duration_ms = elapsed.as_millis() as u64;
        match &result {
            Ok(response) if response.get_ref().ok => {
                record_rpc_call(RpcMethod::GetSessionTranscript, RpcOutcome::Success, elapsed);
                let detail = format!(
                    "entries_count={}",
                    response.get_ref().entries.len()
                );
                rpc_helpers::log_rpc_completion(
                    "GetSessionTranscript",
                    &meta.request_id,
                    &req.session_id,
                    &meta.tenant_id,
                    &meta.trace_id,
                    "success",
                    duration_ms,
                    &detail,
                );
            }
            Ok(response) => {
                let error_code = response
                    .get_ref()
                    .error
                    .as_ref()
                    .map(|error| error.code.as_str())
                    .unwrap_or("UNKNOWN");
                let outcome = if error_code == "RESOURCE_NOT_FOUND" {
                    RpcOutcome::NotFound
                } else {
                    RpcOutcome::Error
                };
                record_rpc_call(RpcMethod::GetSessionTranscript, outcome, elapsed);
                let detail = format!("error_code={error_code}");
                rpc_helpers::log_rpc_completion(
                    "GetSessionTranscript",
                    &meta.request_id,
                    &req.session_id,
                    &meta.tenant_id,
                    &meta.trace_id,
                    if error_code == "RESOURCE_NOT_FOUND" {
                        "not_found"
                    } else {
                        "error"
                    },
                    duration_ms,
                    &detail,
                );
            }
            Err(status) => {
                record_rpc_call(RpcMethod::GetSessionTranscript, RpcOutcome::Error, elapsed);
                rpc_helpers::log_rpc_failure(
                    "GetSessionTranscript",
                    &meta.request_id,
                    &req.session_id,
                    &meta.tenant_id,
                    &meta.trace_id,
                    duration_ms,
                    status,
                );
            }
        }

        result
    }

    async fn get_all_session_ids(
        &self,
        request: Request<GetAllSessionIdsRequest>,
    ) -> Result<Response<GetSessionIdsLookupResponse>, Status> {
        let req = request.get_ref();
        let meta = request_meta::read_meta(req.meta.as_ref())?;

        let session_ids = self
            .session_repo()
            .list_all_session_ids(&meta.tenant_id, MAX_PAGE_SIZE as i64)
            .await
            .map_err(|e| Status::internal(format!("failed to list all session ids: {e}")))?;

        Ok(response_helpers::ok_lookup_session_ids(
            session_ids.into_iter().map(|id| id.to_string()).collect(),
        ))
    }

    async fn get_session_summary(
        &self,
        request: Request<GetSessionSummaryRequest>,
    ) -> Result<Response<GetSessionSummaryResponse>, Status> {
        let req = request.get_ref();
        let meta = request_meta::read_meta(req.meta.as_ref())?;

        let session_id = parse_uuid(&req.session_id)
            .map_err(|e| Status::invalid_argument(format!("invalid session_id: {e}")))?;

        let summary = self
            .summary_repo()
            .latest_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to get session summary: {e}")))?
            .map(|record| record.summary)
            .unwrap_or_default();

        Ok(response_helpers::ok_get_session_summary(summary))
    }

    async fn get_session_ids_by_domain_class(
        &self,
        request: Request<GetSessionIdsByDomainClassRequest>,
    ) -> Result<Response<GetSessionIdsLookupResponse>, Status> {
        let req = request.get_ref();
        let meta = request_meta::read_meta(req.meta.as_ref())?;
        let anchor_repo = self.anchor_repo();
        session_lookup::lookup_by_domain_class(
            &anchor_repo,
            &meta.tenant_id,
            &req.domain_class,
            MAX_PAGE_SIZE as i64,
        )
        .await
    }

    async fn get_session_ids_by_ner(
        &self,
        request: Request<GetSessionIdsByNerRequest>,
    ) -> Result<Response<GetSessionIdsLookupResponse>, Status> {
        let req = request.get_ref();
        let meta = request_meta::read_meta(req.meta.as_ref())?;
        let fact_repo = self.fact_repo();
        session_lookup::lookup_by_ner(
            &fact_repo,
            &meta.tenant_id,
            &req.ner,
            MAX_PAGE_SIZE as i64,
        )
        .await
    }

    async fn get_session_ids_by_intent_type(
        &self,
        request: Request<GetSessionIdsByIntentTypeRequest>,
    ) -> Result<Response<GetSessionIdsLookupResponse>, Status> {
        let req = request.get_ref();
        let meta = request_meta::read_meta(req.meta.as_ref())?;
        let anchor_repo = self.anchor_repo();
        session_lookup::lookup_by_intent_type(
            &anchor_repo,
            &meta.tenant_id,
            &req.intent_type,
            MAX_PAGE_SIZE as i64,
        )
        .await
    }

    async fn query_memory(
        &self,
        request: Request<QueryMemoryRequest>,
    ) -> Result<Response<QueryMemoryResponse>, Status> {
        let started_at = Instant::now();
        let mut guard = RpcGuard::new(&self.rpc_metrics, "query_memory");
        let req = request.get_ref();
        let meta = request_meta::read_meta_with_guard(req.meta.as_ref(), &mut guard)?;

        let explicit_intent = Self::explicit_query_intent(req.query_intent);

        if explicit_intent == Some(QueryIntentType::Recall) && req.session_id.trim().is_empty() {
            let hits = self
                .retrieve_global_session_summaries(
                    &meta.tenant_id,
                    if req.top_k > 0 { req.top_k } else { MAX_TOP_K },
                )
                .await
                .map_err(|status| {
                    guard.error();
                    status
                })?;

            let result = Ok(response_helpers::ok_query_memory(hits));

            let elapsed = started_at.elapsed();
            if let Ok(response) = &result {
                rpc_helpers::finish_query_memory_success(
                    meta,
                    &req.session_id,
                    req.retrieve_policy,
                    req.domain_class.trim(),
                    Some("query_intent=recall_global_summaries"),
                    elapsed,
                    response,
                );
            }
            return result;
        }

        // Build retrieve context
        let domain_class = req.domain_class.trim().to_string();

        let mut ctx = RetrieveContext::new(
            &meta.tenant_id,
            &domain_class,
            &req.query_text,
            if req.top_k > 0 { req.top_k } else { MAX_TOP_K },
        );

        if !req.session_id.is_empty() {
            ctx = ctx.with_session_id(&req.session_id);
        }

        // Explicit internal query analyzer for structured retrieval context.
        let query_analysis = QueryAnalyzer::new()
            .analyze(&req.query_text, &domain_class, &req.session_id)
            .unwrap_or_else(|error| {
                tracing::warn!(
                    error = %error,
                    tenant_id = %meta.tenant_id,
                    session_id = req.session_id,
                    domain_class = domain_class,
                    "query analyzer failed, falling back to raw retrieval context"
                );
                QueryAnalysis::fallback(&domain_class, &req.query_text)
            });
        let resolved_intent = explicit_intent.unwrap_or_else(|| match query_analysis.intent_type.as_str() {
            "recall" => QueryIntentType::Recall,
            "compare" => QueryIntentType::Compare,
            "disambiguate" => QueryIntentType::Disambiguate,
            "correct" => QueryIntentType::Correct,
            "explain" => QueryIntentType::Explain,
            "decide" => QueryIntentType::Decide,
            _ => QueryIntentType::None,
        });
        let mut relation_types = query_analysis.relation_types;
        if relation_types.is_empty() {
            match resolved_intent {
                QueryIntentType::Compare => relation_types.push("comparison".to_string()),
                QueryIntentType::Disambiguate => relation_types.push("disambiguation".to_string()),
                QueryIntentType::Correct => relation_types.push("correction".to_string()),
                _ => {}
            }
        }
        ctx = ctx.with_query_analysis(
            query_analysis.domain_classes,
            query_analysis.entities,
            relation_types,
            resolved_intent.as_str(),
            query_analysis.intent_aux,
            query_analysis.recall_target_type,
        );

        let results = retrieve_by_policy(self.runtime.pool(), &ctx, req.retrieve_policy)
            .await
            .map_err(|e| {
                guard.error();
                Status::internal(format!("retrieval failed: {e}"))
            })?;

        let tenant_id = meta.tenant_id.clone();
        let hits = query_memory_hits::hydrate_query_memory_hits(results, |session_id| {
            let tenant_id = tenant_id.clone();
            async move {
                self.load_session_transcript_for_query_memory(&tenant_id, &session_id)
                    .await
            }
        })
        .await;

        let result = Ok(response_helpers::ok_query_memory(hits));

        let elapsed = started_at.elapsed();
        match &result {
            Ok(response) => {
                rpc_helpers::finish_query_memory_success(
                    meta,
                    &req.session_id,
                    req.retrieve_policy,
                    &domain_class,
                    None,
                    elapsed,
                    response,
                );
            }
            Err(status) => {
                let duration_ms = elapsed.as_millis() as u64;
                record_rpc_call(RpcMethod::QueryMemory, RpcOutcome::Error, elapsed);
                rpc_helpers::log_rpc_failure(
                    "QueryMemory",
                    &meta.request_id,
                    &req.session_id,
                    &meta.tenant_id,
                    &meta.trace_id,
                    duration_ms,
                    status,
                );
            }
        }

        result
    }

    async fn append_memory(
        &self,
        request: Request<AppendMemoryRequest>,
    ) -> Result<Response<AppendMemoryResponse>, Status> {
        let started_at = Instant::now();
        let mut guard = RpcGuard::new(&self.rpc_metrics, "append_memory");
        let req = request.get_ref();
        let meta = request_meta::read_write_meta_with_guard(req.meta.as_ref(), &mut guard)?;

        if req.entries.is_empty() {
            return Ok(response_helpers::ok_append_memory(0));
        }

        let session_id =
            parse_uuid(&req.session_id).map_err(|e| { guard.error(); Status::invalid_argument(format!("invalid session_id: {e}")) })?;

        // Step 1: Idempotency check
        let is_new = self
            .idempotency_repo()
            .try_record(
                &meta.idempotency_key,
                &meta.tenant_id,
                session_id,
                "append_memory",
                &meta.request_id,
            )
            .await
            .map_err(|e| { guard.error(); Status::internal(format!("idempotency check failed: {e}")) })?;

        if !is_new {
            // Duplicate request — nothing new to append
            return Ok(response_helpers::ok_append_memory(0));
        }

        // Step 2: Allocate sequence numbers within a transaction
        let pool = self.runtime.pool();
        let tenant_id = meta.tenant_id.clone();
        let entries_count = req.entries.len() as i64;

        let mut tx = pool
            .begin()
            .await
            .map_err(|e| { guard.error(); Status::internal(format!("failed to begin transaction: {e}")) })?;

        // Serialize sequence allocation per tenant/session so concurrent appends
        // cannot observe the same base sequence number.
        let sequence_lock_key = format!("{tenant_id}:{session_id}");
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(&sequence_lock_key)
            .execute(&mut *tx)
            .await
            .map_err(|e| { guard.error(); Status::internal(format!("failed to acquire sequence lock: {e}")) })?;

        let base_seq = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COALESCE(MAX(sequence_num), 0)
            FROM memory_entries
            WHERE tenant_id = $1 AND session_id = $2
            "#,
        )
        .bind(&tenant_id)
        .bind(session_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| { guard.error(); Status::internal(format!("failed to query max sequence_num: {e}")) })?;

        // Step 3: Prepare entries with L0 content and write to object storage first.
        // Raw user/assistant turns are stored in L0/L1 `memory_entries`; we do not
        // project them into any retrieval index here. Session-level retrieval happens
        // through asynchronous summary memory units instead.
        let prepared = append_builder::build_append_entries(
            &req.entries,
            self.object_store.as_ref(),
            &tenant_id,
            session_id,
            base_seq,
            &meta.request_id,
            &meta.trace_id,
        )
        .await;
        let entries_to_insert = prepared.entries_to_insert;
        let appended_units = prepared.appended_units;

        // Step 4: Insert entries into PostgreSQL.
        let mut appended = 0i32;
        for insert in entries_to_insert {
            let result = sqlx::query(
                r#"
                INSERT INTO memory_entries (
                    id, tenant_id, session_id, sequence_num,
                    role, raw_content_ref, message_ts, metadata_json,
                    l0_uri, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
                "#,
            )
            .bind(insert.id)
            .bind(&insert.tenant_id)
            .bind(insert.session_id)
            .bind(insert.sequence_num)
            .bind(&insert.role)
            .bind(&insert.raw_content_ref)
            .bind(insert.message_ts)
            .bind(&insert.metadata_json)
            .bind(&insert.l0_uri)
            .execute(&mut *tx)
            .await
            .map_err(|e| { guard.error(); Status::internal(format!("failed to insert memory entry: {e}")) })?;

            if result.rows_affected() > 0 {
                appended += 1;
            }
        }

        tx.commit()
            .await
            .map_err(|e| { guard.error(); Status::internal(format!("failed to commit transaction: {e}")) })?;

        if appended > 0 {
            MemoryUnitMaterializer::new(self.runtime.pool())
                .materialize_appended_entries(&appended_units)
                .await
                .map_err(|e| { guard.error(); Status::internal(format!("failed to materialize memory units: {e}")) })?;
        }

        tracing::info!(
            rpc = "append_memory",
            request_id = %meta.request_id,
            session_id = %meta.session_id,
            tenant_id = %tenant_id,
            user_id = %meta.user_id,
            trace_id = %meta.trace_id,
            latency_ms = guard.elapsed_ms(),
            status = "ok",
            appended_count = appended,
            requested_count = entries_count,
            "rpc completed"
        );

        if appended > 0 && self.config.summary.async_enabled {
            let runner = SummaryTaskRunner::new(
                self.runtime.pool(),
                self.object_store.clone(),
                self.config.summary.clone(),
                self.config.retry.clone(),
            );
            let job = SummaryJob::new(
                tenant_id.clone(),
                session_id,
                "session-rollup".to_string(),
                meta.request_id.clone(),
            );
            tokio::spawn(async move {
                if let Err(error) = runner.run(job.clone()).await {
                    tracing::warn!(
                        error = %error,
                        session_id = %job.session_id,
                        "summary task failed after append_memory"
                    );
                }
            });
        }

        let result = Ok(response_helpers::ok_append_memory(appended));

        let elapsed = started_at.elapsed();
        let duration_ms = elapsed.as_millis() as u64;
        match &result {
            Ok(response) => {
                record_rpc_call(RpcMethod::AppendMemory, RpcOutcome::Success, elapsed);
                let detail = format!(
                    "appended_count={},requested_count={}",
                    response.get_ref().appended_count,
                    entries_count
                );
                rpc_helpers::log_rpc_completion(
                    "AppendMemory",
                    &meta.request_id,
                    &req.session_id,
                    &meta.tenant_id,
                    &meta.trace_id,
                    "success",
                    duration_ms,
                    &detail,
                );
            }
            Err(status) => {
                record_rpc_call(RpcMethod::AppendMemory, RpcOutcome::Error, elapsed);
                rpc_helpers::log_rpc_failure(
                    "AppendMemory",
                    &meta.request_id,
                    &req.session_id,
                    &meta.tenant_id,
                    &meta.trace_id,
                    duration_ms,
                    status,
                );
            }
        }

        result
    }

    async fn summarize_memory(
        &self,
        request: Request<SummarizeMemoryRequest>,
    ) -> Result<Response<SummarizeMemoryResponse>, Status> {
        let req = request.get_ref();
        let meta = request_meta::read_write_meta(req.meta.as_ref())?;

        let session_id =
            parse_uuid(&req.session_id).map_err(|e| Status::invalid_argument(format!("invalid session_id: {e}")))?;

        if !self.config.summary.async_enabled {
            return Ok(response_helpers::summarize_async_disabled());
        }

        let accepted = self
            .idempotency_repo()
            .try_record(
                &meta.idempotency_key,
                &meta.tenant_id,
                session_id,
                "summarize_memory",
                &meta.request_id,
            )
            .await
            .map_err(|e| Status::internal(format!("summary idempotency check failed: {e}")))?;

        if !accepted {
            return Ok(response_helpers::ok_summarize_memory(format!(
                "summary task already accepted for session {}",
                req.session_id
            )));
        }

        let runner = SummaryTaskRunner::new(
            self.runtime.pool(),
            self.object_store.clone(),
            self.config.summary.clone(),
            self.config.retry.clone(),
        );
        let job = SummaryJob::new(
            meta.tenant_id.clone(),
            session_id,
            req.strategy.clone(),
            meta.request_id.clone(),
        );
        tokio::spawn(async move {
            if let Err(error) = runner.run(job.clone()).await {
                tracing::warn!(error = %error, session_id = %job.session_id, "summary task failed after all retries");
            }
        });

        Ok(response_helpers::ok_summarize_memory(format!(
            "summary task accepted for session {}",
            req.session_id
        )))
    }

    async fn delete_session(
        &self,
        request: Request<DeleteSessionRequest>,
    ) -> Result<Response<DeleteSessionResponse>, Status> {
        let req = request.get_ref();
        let meta = request_meta::read_write_meta(req.meta.as_ref())?;

        let session_id =
            parse_uuid(&req.session_id)
                .map_err(|e| Status::invalid_argument(format!("invalid session_id: {e}")))?;

        // Delete related data in reverse dependency order
        let deleted_anchors = self
            .anchor_repo()
            .delete_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete anchors: {e}")))?;

        let deleted_units = self
            .unit_repo()
            .delete_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete memory units: {e}")))?;

        let deleted_facts = self
            .fact_repo()
            .delete_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete facts: {e}")))?;

        let deleted_summaries = self
            .summary_repo()
            .delete_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete summaries: {e}")))?;

        let deleted_entries = self
            .entry_repo()
            .delete_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete entries: {e}")))?;

        self.session_repo()
            .delete_by_id(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete session: {e}")))?;

        info!(
            session_id = %session_id,
            tenant_id = %meta.tenant_id,
            deleted_anchors,
            deleted_units,
            deleted_facts,
            deleted_summaries,
            deleted_entries,
            "session deleted with all related data"
        );

        Ok(response_helpers::ok_delete_session(
            deleted_facts as i32,
            deleted_units as i32,
            deleted_anchors as i32,
            deleted_entries as i32,
            deleted_summaries as i32,
        ))
    }

    async fn delete_memory_entry(
        &self,
        request: Request<DeleteMemoryEntryRequest>,
    ) -> Result<Response<DeleteMemoryEntryResponse>, Status> {
        let req = request.get_ref();
        let meta = request_meta::read_write_meta(req.meta.as_ref())?;

        let session_id = parse_uuid(&req.session_id)
            .map_err(|e| Status::invalid_argument(format!("invalid session_id: {e}")))?;
        let entry_id = parse_uuid(&req.entry_id)
            .map_err(|e| Status::invalid_argument(format!("invalid entry_id: {e}")))?;

        let Some(_) = self
            .entry_repo()
            .get_by_id(&meta.tenant_id, session_id, entry_id)
            .await
            .map_err(|e| Status::internal(format!("failed to get memory entry: {e}")))?
        else {
            return Ok(response_helpers::memory_entry_not_found());
        };

        let deleted_anchors = self
            .anchor_repo()
            .delete_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete anchors: {e}")))?;
        let deleted_units = self
            .unit_repo()
            .delete_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete memory units: {e}")))?;
        let deleted_facts = self
            .fact_repo()
            .delete_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete facts: {e}")))?;
        let deleted_summaries = self
            .summary_repo()
            .delete_by_session(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete summaries: {e}")))?;

        let deleted_entries = self
            .entry_repo()
            .delete_by_id(&meta.tenant_id, session_id, entry_id)
            .await
            .map_err(|e| Status::internal(format!("failed to delete memory entry: {e}")))?;

        if deleted_entries == 0 {
            return Ok(response_helpers::memory_entry_not_found());
        }

        let rebuilt_units = self.rebuild_session_units(&meta.tenant_id, session_id).await?;
        if rebuilt_units > 0 {
            self.spawn_summary_refresh(meta.tenant_id.clone(), session_id, meta.request_id.clone());
        }

        let remaining_entries = self
            .entry_repo()
            .list_by_session_ordered(&meta.tenant_id, session_id)
            .await
            .map_err(|e| Status::internal(format!("failed to count remaining entries: {e}")))?
            .len() as i32;

        info!(
            tenant_id = %meta.tenant_id,
            session_id = %session_id,
            entry_id = %entry_id,
            deleted_anchors,
            deleted_units,
            deleted_facts,
            deleted_summaries,
            rebuilt_units,
            remaining_entries,
            "memory entry deleted and session indexes rebuilt"
        );

        Ok(response_helpers::ok_delete_memory_entry(true, remaining_entries))
    }
}
