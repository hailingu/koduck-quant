use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use tokio::sync::Semaphore;
use tracing::{info, instrument, warn};
use uuid::Uuid;

use crate::config::{RetrySection, SummarySection};
use crate::facts::{InsertMemoryFact, MemoryFact, MemoryFactRepository};
use crate::index::{InsertMemoryIndexRecord, MemoryIndexRepository};
use crate::memory::MemoryEntryRepository;
use crate::memory_unit::{FactUnitInput, MemoryUnitMaterializer, SummaryUnitInput};
use crate::reliability::{TaskAttemptRepository, with_retry};
use crate::retrieve::domain_class;
use crate::session::SessionRepository;
use crate::store::ObjectStoreClient;
use crate::summary::{InsertMemorySummary, MemorySummary, MemorySummaryRepository};
use crate::Result;

const DEFAULT_STRATEGY: &str = "session-rollup";
const MAX_SUMMARY_CHARS: usize = 1_200;
const MAX_FACT_CHARS: usize = 220;
const MAX_FACTS_PER_RUN: usize = 8;
const MAX_PERSONS_PER_RUN: usize = 6;

#[derive(Debug, Clone)]
pub struct SummaryJob {
    pub tenant_id: String,
    pub session_id: Uuid,
    pub strategy: String,
    pub request_id: String,
}

impl SummaryJob {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        strategy: impl Into<String>,
        request_id: impl Into<String>,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            session_id,
            strategy: normalize_strategy(strategy.into()),
            request_id: request_id.into(),
        }
    }
}

#[derive(Clone)]
pub struct SummaryTaskRunner {
    entry_repo: MemoryEntryRepository,
    session_repo: SessionRepository,
    summary_repo: MemorySummaryRepository,
    fact_repo: MemoryFactRepository,
    attempt_repo: TaskAttemptRepository,
    index_repo: MemoryIndexRepository,
    unit_materializer: MemoryUnitMaterializer,
    object_store: Option<ObjectStoreClient>,
    retry_config: RetrySection,
    summary_config: SummarySection,
    llm_gate: Arc<Semaphore>,
}

impl SummaryTaskRunner {
    pub fn new(
        pool: &PgPool,
        object_store: Option<ObjectStoreClient>,
        summary_config: SummarySection,
        retry_config: RetrySection,
    ) -> Self {
        Self {
            entry_repo: MemoryEntryRepository::new(pool),
            session_repo: SessionRepository::new(pool),
            summary_repo: MemorySummaryRepository::new(pool),
            fact_repo: MemoryFactRepository::new(pool),
            attempt_repo: TaskAttemptRepository::new(pool),
            index_repo: MemoryIndexRepository::new(pool),
            unit_materializer: MemoryUnitMaterializer::new(pool),
            object_store,
            retry_config,
            llm_gate: Arc::new(Semaphore::new(summary_config.llm_max_concurrency.max(1))),
            summary_config,
        }
    }

    #[instrument(skip(self), fields(tenant_id = %job.tenant_id, session_id = %job.session_id, strategy = %job.strategy, request_id = %job.request_id))]
    pub async fn run(&self, job: SummaryJob) -> Result<MemorySummary> {
        let materialized = self.materialize_summary(job).await?;

        if let Err(error) = with_retry(
            "summary_index_refresh",
            &materialized.stored_summary.tenant_id,
            materialized.stored_summary.session_id,
            &materialized.request_id,
            &self.attempt_repo,
            &self.retry_config,
            || {
                let runner = self.clone();
                let materialized = materialized.clone();
                async move { runner.refresh_summary_index(&materialized).await }
            },
        )
        .await
        {
            warn!(
                error = %error,
                session_id = %materialized.stored_summary.session_id,
                "summary index refresh failed after all retries"
            );
        }

        let mut fact_count = 0usize;
        match with_retry(
            "summary_facts_extract",
            &materialized.stored_summary.tenant_id,
            materialized.stored_summary.session_id,
            &materialized.request_id,
            &self.attempt_repo,
            &self.retry_config,
            || {
                let runner = self.clone();
                let materialized = materialized.clone();
                async move { runner.materialize_facts(&materialized).await }
            },
        )
        .await
        {
            Ok(facts) => {
                fact_count = facts.len();
            }
            Err(error) => {
                warn!(
                    error = %error,
                    session_id = %materialized.stored_summary.session_id,
                    "fact extraction failed after all retries"
                );
            }
        }

        info!(
            summary_id = %materialized.stored_summary.id,
            version = materialized.stored_summary.version,
            domain_class = %materialized.stored_summary.domain_class,
            fact_count,
            "summary task completed"
        );

        Ok(materialized.stored_summary)
    }

    async fn materialize_summary(&self, job: SummaryJob) -> Result<SummaryMaterialization> {
        let mut entries = self
            .entry_repo
            .list_by_session(&job.tenant_id, job.session_id, None)
            .await?;
        entries.sort_by_key(|entry| entry.sequence_num);

        let session = self
            .session_repo
            .get_by_id(&job.tenant_id, job.session_id)
            .await?;

        let transcript = build_transcript_fragments(&entries, self.object_store.as_ref()).await;
        let session_title = session.as_ref().map(|s| s.title.as_str());
        let inferred_domain_class = with_retry(
            "summary_domain_class_generate",
            &job.tenant_id,
            job.session_id,
            &job.request_id,
            &self.attempt_repo,
            &self.retry_config,
            || {
                let transcript = transcript.clone();
                let summary_config = self.summary_config.clone();
                let llm_gate = self.llm_gate.clone();
                async move {
                    classify_domain_class(&transcript, session_title, &summary_config, llm_gate).await
                }
            },
        )
        .await?;
        let entry_count = entries.len();
        let summary_artifact = with_retry(
            "summary_generate",
            &job.tenant_id,
            job.session_id,
            &job.request_id,
            &self.attempt_repo,
            &self.retry_config,
            || {
                let transcript = transcript.clone();
                let summary_config = self.summary_config.clone();
                let llm_gate = self.llm_gate.clone();
                let inferred_domain_class = inferred_domain_class.clone();
                async move {
                    build_summary_artifact(
                        &transcript,
                        entry_count,
                        session_title,
                        &inferred_domain_class,
                        &summary_config,
                        llm_gate,
                    )
                    .await
                }
            },
        )
        .await?;
        let version = self.summary_repo.next_version(&job.tenant_id, job.session_id).await?;

        let insert_summary = InsertMemorySummary::new(
            job.tenant_id.clone(),
            job.session_id,
            inferred_domain_class.clone(),
            summary_artifact.summary,
            job.strategy.clone(),
            summary_artifact.summary_source,
            summary_artifact.llm_error_class,
            version,
        );
        let stored = self.summary_repo.insert(&insert_summary).await?;
        let session_snippet = if transcript.is_empty() {
            summary_artifact.snippet.clone()
        } else {
            transcript.join("\n")
        };

        Ok(SummaryMaterialization {
            stored_summary: stored,
            summary_snippet: session_snippet,
            transcript,
            session_title: session.as_ref().and_then(|value| {
                let title = value.title.trim();
                if title.is_empty() {
                    None
                } else {
                    Some(title.to_string())
                }
            }),
            entry_sequence_range: entries
                .first()
                .zip(entries.last())
                .map(|(first, last)| (first.sequence_num, last.sequence_num)),
            time_bucket: entries
                .last()
                .map(|entry| entry.message_ts.format("%Y-%m").to_string()),
            request_id: job.request_id,
            test_strategy: job.strategy,
        })
    }

    async fn refresh_summary_index(&self, materialized: &SummaryMaterialization) -> Result<()> {
        maybe_inject_test_failure(
            &materialized.test_strategy,
            &materialized.request_id,
            "summary_index_refresh",
        )?;

        let stored = &materialized.stored_summary;
        self.index_repo
            .delete_by_session(&stored.tenant_id, stored.session_id)
            .await?;
        let summary_uri = build_summary_uri(&stored.tenant_id, stored.session_id, stored.version);
        let index_record = InsertMemoryIndexRecord::new(
            stored.tenant_id.clone(),
            stored.session_id,
            "summary",
            stored.domain_class.clone(),
            stored.summary.clone(),
            summary_uri.clone(),
        )
        .with_memory_unit_id(stored.session_id)
        .with_snippet(materialized.summary_snippet.clone())
        .with_score_hint("0.95");
        self.index_repo.insert(&index_record).await?;
        if let Some((entry_range_start, entry_range_end, time_bucket)) = materialized.entry_range() {
            self.unit_materializer
                .upsert_summary_unit(&SummaryUnitInput {
                    tenant_id: stored.tenant_id.clone(),
                    session_id: stored.session_id,
                    domain_class: stored.domain_class.clone(),
                    summary: stored.summary.clone(),
                    snippet: materialized.summary_snippet.clone(),
                    source_uri: summary_uri,
                    entry_range_start,
                    entry_range_end,
                    time_bucket,
                })
                .await?;
        }
        Ok(())
    }

    async fn materialize_facts(
        &self,
        materialized: &SummaryMaterialization,
    ) -> Result<Vec<MemoryFact>> {
        maybe_inject_test_failure(
            &materialized.test_strategy,
            &materialized.request_id,
            "summary_facts_extract",
        )?;

        let fact_candidates = build_fact_candidates(
            &materialized.transcript,
            materialized.session_title.as_deref(),
            &materialized.stored_summary.domain_class,
            &self.summary_config,
            self.llm_gate.clone(),
        )
        .await?;

        self.fact_repo
            .delete_by_session(
                &materialized.stored_summary.tenant_id,
                materialized.stored_summary.session_id,
            )
            .await?;

        let mut facts = Vec::with_capacity(fact_candidates.len());
        for candidate in &fact_candidates {
            let insert_fact = InsertMemoryFact::new(
                &materialized.stored_summary.tenant_id,
                materialized.stored_summary.session_id,
                candidate.fact_type.clone(),
                &materialized.stored_summary.domain_class,
                candidate.fact_text.clone(),
                candidate.confidence,
            );
            facts.push(self.fact_repo.insert(&insert_fact).await?);
        }
        if let Some((entry_range_start, entry_range_end, time_bucket)) = materialized.entry_range() {
            let inputs = facts
                .iter()
                .cloned()
                .map(|fact| FactUnitInput {
                    tenant_id: materialized.stored_summary.tenant_id.clone(),
                    session_id: materialized.stored_summary.session_id,
                    domain_class: materialized.stored_summary.domain_class.clone(),
                    fact,
                    entry_range_start,
                    entry_range_end,
                    time_bucket: time_bucket.clone(),
                })
                .collect::<Vec<_>>();
            self.unit_materializer.replace_fact_units(&inputs).await?;
        }
        Ok(facts)
    }
}

async fn build_transcript_fragments(
    entries: &[crate::memory::MemoryEntry],
    object_store: Option<&ObjectStoreClient>,
) -> Vec<String> {
    let mut fragments = Vec::new();

    for entry in entries {
        let maybe_content = match object_store {
            Some(client) => client
                .get_l0_entry(&entry.l0_uri)
                .await
                .ok()
                .map(|content| content.content),
            None => None,
        };

        let fragment = match maybe_content {
            Some(content) if !content.trim().is_empty() => {
                format!("{}: {}", entry.role, content.trim())
            }
            _ => format!("{} message #{}", entry.role, entry.sequence_num),
        };

        let normalized_fragment = truncate_text(&fragment, 800);
        fragments.push(normalized_fragment);
    }

    fragments
}

#[derive(Debug, Clone, PartialEq)]
struct FactCandidate {
    fact_type: String,
    fact_text: String,
    confidence: f64,
}

#[derive(Debug, Clone)]
struct SummaryMaterialization {
    stored_summary: MemorySummary,
    summary_snippet: String,
    transcript: Vec<String>,
    session_title: Option<String>,
    entry_sequence_range: Option<(i64, i64)>,
    time_bucket: Option<String>,
    request_id: String,
    test_strategy: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ChatCompletionsResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Clone, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Clone, Deserialize)]
struct ChatMessage {
    content: String,
}

#[derive(Debug, Clone, Serialize)]
struct ChatCompletionsRequest<'a> {
    model: &'a str,
    temperature: f32,
    response_format: JsonObjectResponseFormat<'a>,
    messages: Vec<PromptMessage<'a>>,
}

#[derive(Debug, Clone, Serialize)]
struct PromptMessage<'a> {
    role: &'a str,
    content: String,
}

#[derive(Debug, Clone, Serialize)]
struct JsonObjectResponseFormat<'a> {
    #[serde(rename = "type")]
    kind: &'a str,
}

#[derive(Debug, Clone, Deserialize)]
struct ParsedSummaryArtifact {
    summary: String,
    snippet: String,
}

#[derive(Debug, Clone)]
struct SummaryArtifact {
    summary: String,
    snippet: String,
    summary_source: &'static str,
    llm_error_class: &'static str,
}

#[derive(Debug, Clone, Deserialize)]
struct NerArtifact {
    persons: Vec<String>,
    domain_class: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct DomainClassArtifact {
    domain_class: String,
}

impl SummaryMaterialization {
    fn entry_range(&self) -> Option<(i64, i64, String)> {
        self.entry_sequence_range
            .zip(self.time_bucket.clone())
            .map(|((start, end), time_bucket)| (start, end, time_bucket))
    }
}

impl FactCandidate {
    fn new(
        fact_type: impl Into<String>,
        fact_text: impl Into<String>,
        confidence: f64,
    ) -> Option<Self> {
        let fact_text = truncate_text(&fact_text.into(), MAX_FACT_CHARS);
        if fact_text.is_empty() {
            return None;
        }

        Some(Self {
            fact_type: fact_type.into(),
            fact_text,
            confidence,
        })
    }
}

async fn build_summary_artifact(
    transcript: &[String],
    entry_count: usize,
    session_title: Option<&str>,
    inferred_domain_class: &str,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Result<SummaryArtifact> {
    if !summary_config.llm_enabled {
        anyhow::bail!("summary llm is disabled; heuristic fallback has been removed");
    }

    generate_summary_via_llm(
        transcript,
        entry_count,
        session_title,
        inferred_domain_class,
        summary_config,
        llm_gate,
    )
    .await
}

async fn generate_summary_via_llm(
    transcript: &[String],
    entry_count: usize,
    session_title: Option<&str>,
    inferred_domain_class: &str,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Result<SummaryArtifact> {
    if summary_config.llm_api_key.trim().is_empty() {
        anyhow::bail!("summary llm api key is empty; heuristic fallback has been removed");
    }

    let _permit = llm_gate.acquire_owned().await?;

    let client = Client::builder()
        .timeout(Duration::from_millis(summary_config.llm_timeout_ms))
        .build()?;
    let url = format!(
        "{}/chat/completions",
        summary_config.llm_base_url.trim_end_matches('/')
    );
    let session_title = session_title.unwrap_or("untitled");
    let transcript_text = transcript.join("\n");
    let request = ChatCompletionsRequest {
        model: &summary_config.llm_model,
        temperature: 0.2,
        response_format: JsonObjectResponseFormat { kind: "json_object" },
        messages: vec![
            PromptMessage {
                role: "system",
                content: "你是一个有帮助的 AI 助手，用50个以内的字简洁、准确、陈述的方式总结用户的问题。你必须只返回 JSON 格式数据，不要输出任何解释、markdown、代码块或多余文本。返回格式示例：{\"summary\":\"这里是总结\",\"snippet\":\"这里是短摘要\"}。summary 和 snippet 都用中文。".to_string(),
            },
            PromptMessage {
                role: "user",
                content: format!(
                    "session_title: {session_title}\ndomain_class_hint: {inferred_domain_class}\nentry_count: {entry_count}\ntranscript:\n{transcript_text}\n用50个以内的字、简洁准确陈述的方式总结上面的内容"
                ),
            },
        ],
    };

    let response = client
        .post(url)
        .bearer_auth(&summary_config.llm_api_key)
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("summary llm returned {status}: {body}");
    }

    let payload: ChatCompletionsResponse = response.json().await?;
    let content = payload
        .choices
        .first()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|text| !text.is_empty());

    let Some(content) = content else {
        anyhow::bail!("summary llm returned empty choices content");
    };

    let artifact = parse_summary_artifact(&content)?;
    Ok(SummaryArtifact {
        summary: truncate_text(&artifact.summary, MAX_SUMMARY_CHARS),
        snippet: truncate_text(&artifact.snippet, 96),
        summary_source: "llm",
        llm_error_class: "none",
    })
}

fn parse_summary_artifact(content: &str) -> Result<SummaryArtifact> {
    let sanitized = strip_think_blocks(content);

    if let Ok(artifact) = serde_json::from_str::<ParsedSummaryArtifact>(&sanitized) {
        return Ok(SummaryArtifact {
            summary: artifact.summary,
            snippet: artifact.snippet,
            summary_source: "llm",
            llm_error_class: "none",
        });
    }

    if let Some(candidate) = extract_last_json_object(&sanitized) {
        if let Ok(artifact) = serde_json::from_str::<ParsedSummaryArtifact>(candidate) {
            return Ok(SummaryArtifact {
                summary: artifact.summary,
                snippet: artifact.snippet,
                summary_source: "llm",
                llm_error_class: "none",
            });
        }
    }

    anyhow::bail!(
        "summary llm did not return valid json; raw_content={}",
        truncate_text(content, 500)
    )
}

async fn classify_domain_class(
    transcript: &[String],
    session_title: Option<&str>,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Result<String> {
    if !summary_config.llm_enabled {
        anyhow::bail!("domain class llm is disabled; heuristic fallback has been removed");
    }

    generate_domain_class_via_llm(transcript, session_title, summary_config, llm_gate).await
}

async fn generate_domain_class_via_llm(
    transcript: &[String],
    session_title: Option<&str>,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Result<String> {
    if summary_config.llm_api_key.trim().is_empty() {
        anyhow::bail!("domain class llm api key is empty; heuristic fallback has been removed");
    }

    let _permit = llm_gate.acquire_owned().await?;

    let client = Client::builder()
        .timeout(Duration::from_millis(summary_config.llm_timeout_ms))
        .build()?;
    let url = format!(
        "{}/chat/completions",
        summary_config.llm_base_url.trim_end_matches('/')
    );
    let session_title = session_title.unwrap_or("untitled");
    let transcript_text = transcript.join("\n");
    let allowed_domain_classes = domain_class::ALL.join(", ");
    let request = ChatCompletionsRequest {
        model: &summary_config.llm_model,
        temperature: 0.0,
        response_format: JsonObjectResponseFormat { kind: "json_object" },
        messages: vec![
            PromptMessage {
                role: "system",
                content: format!(
                    "你是一个会话主题分类助手。请基于整个会话 transcript（包含用户提问和助手回答）做单标签分类。你必须只返回 JSON 格式数据，不要输出任何解释、markdown、代码块或多余文本。返回格式示例：{{\"domain_class\":\"history\"}}。domain_class 只能从以下候选中选择一个：{allowed_domain_classes}。如果最贴近的是任务执行类，返回 task；如果是纯系统消息，返回 system；如果无法判断，返回 chat。"
                ),
            },
            PromptMessage {
                role: "user",
                content: format!(
                    "session_title: {session_title}\n请基于下面完整 transcript 选择最贴切的单个 domain_class。\ntranscript:\n{transcript_text}"
                ),
            },
        ],
    };

    let response = client
        .post(url)
        .bearer_auth(&summary_config.llm_api_key)
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("domain class llm returned {status}: {body}");
    }

    let payload: ChatCompletionsResponse = response.json().await?;
    let content = payload
        .choices
        .first()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|text| !text.is_empty());

    let Some(content) = content else {
        anyhow::bail!("domain class llm returned empty choices content");
    };

    let artifact = parse_domain_class_artifact(&content)?;
    let normalized = artifact.domain_class.trim().to_lowercase();
    if !domain_class::is_valid(&normalized) {
        anyhow::bail!("domain class llm returned unsupported domain_class={normalized}");
    }

    Ok(normalized)
}

async fn build_fact_candidates(
    transcript: &[String],
    session_title: Option<&str>,
    inferred_domain_class: &str,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Result<Vec<FactCandidate>> {
    if !summary_config.llm_enabled {
        anyhow::bail!("summary ner llm is disabled; heuristic fallback has been removed");
    }
    if summary_config.llm_api_key.trim().is_empty() {
        anyhow::bail!("summary ner llm api key is empty; heuristic fallback has been removed");
    }
    if transcript.is_empty() {
        return Ok(Vec::new());
    }

    let artifact = generate_ner_artifact_via_llm(
        transcript,
        session_title,
        inferred_domain_class,
        summary_config,
        llm_gate,
    )
    .await?;

    let mut candidates = Vec::new();
    let mut seen = HashSet::new();
    let ner_domain_class = artifact.domain_class.clone();
    let ner_person_count = artifact.persons.len();
    info!(
        inferred_domain_class = %inferred_domain_class,
        ner_domain_class = ner_domain_class.as_deref().unwrap_or(""),
        ner_person_count,
        "summary ner generation succeeded"
    );

    for person in artifact.persons.into_iter().take(MAX_PERSONS_PER_RUN) {
        push_fact_candidate(
            &mut candidates,
            &mut seen,
            FactCandidate::new("person", person, 0.93),
        );
    }
    candidates.truncate(MAX_FACTS_PER_RUN);
    info!(
        inferred_domain_class = %inferred_domain_class,
        fact_count = candidates.len(),
        fact_source = if candidates.is_empty() { "ner_empty" } else { "ner" },
        "fact candidates prepared"
    );
    Ok(candidates)
}

async fn generate_ner_artifact_via_llm(
    transcript: &[String],
    session_title: Option<&str>,
    inferred_domain_class: &str,
    summary_config: &SummarySection,
    llm_gate: Arc<Semaphore>,
) -> Result<NerArtifact> {
    if summary_config.llm_api_key.trim().is_empty() {
        anyhow::bail!("summary ner llm api key is empty; heuristic fallback has been removed");
    }

    let _permit = llm_gate.acquire_owned().await?;

    let client = Client::builder()
        .timeout(Duration::from_millis(summary_config.llm_timeout_ms))
        .build()?;
    let url = format!(
        "{}/chat/completions",
        summary_config.llm_base_url.trim_end_matches('/')
    );
    let session_title = session_title.unwrap_or("untitled");
    let transcript_text = transcript.join("\n");
    let request = ChatCompletionsRequest {
        model: &summary_config.llm_model,
        temperature: 0.0,
        response_format: JsonObjectResponseFormat { kind: "json_object" },
        messages: vec![
            PromptMessage {
                role: "system",
                content: format!(
                    "你是一个NER识别的 AI 助手。请基于整个会话 transcript（包含用户提问和助手回答）提取去重后的 NER 实体，仅保留人名。你必须只返回 JSON 格式数据，不要输出任何解释、markdown、代码块或多余文本。返回格式示例：{{\"persons\":[\"列宁\",\"马克思\"],\"domain_class\":\"history\"}}。persons 只保留 transcript 中真实出现的人名，不要职位、组织、概念、软件名，也不要重复；domain_class 只能从以下候选中选择一个：{}。",
                    domain_class::ALL.join(", ")
                ),
            },
            PromptMessage {
                role: "user",
                content: format!(
                    "session_title: {session_title}\ndomain_class_hint: {inferred_domain_class}\n请基于下面完整 transcript（包含提问和回答）提取人物名。\ntranscript:\n{transcript_text}"
                ),
            },
        ],
    };

    let response = client
        .post(url)
        .bearer_auth(&summary_config.llm_api_key)
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        anyhow::bail!("summary ner llm returned {status}: {body}");
    }

    let payload: ChatCompletionsResponse = response.json().await?;
    let content = payload
        .choices
        .first()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|text| !text.is_empty());

    let Some(content) = content else {
        anyhow::bail!("summary ner llm returned empty choices content");
    };

    let artifact = parse_ner_artifact(&content)?;
    Ok(NerArtifact {
        persons: artifact
            .persons
            .into_iter()
            .map(|value| truncate_text(&value, 64))
            .filter(|value| !value.trim().is_empty())
            .collect(),
        domain_class: artifact
            .domain_class
            .map(|value| truncate_text(&value, 32)),
    })
}

fn parse_ner_artifact(content: &str) -> Result<NerArtifact> {
    let sanitized = strip_think_blocks(content);

    if let Ok(artifact) = serde_json::from_str::<NerArtifact>(&sanitized) {
        return Ok(artifact);
    }

    if let Some(candidate) = extract_last_json_object(&sanitized) {
        if let Ok(artifact) = serde_json::from_str::<NerArtifact>(candidate) {
            return Ok(artifact);
        }
    }

    anyhow::bail!(
        "summary ner llm did not return valid json; raw_content={}",
        truncate_text(content, 500)
    )
}

fn parse_domain_class_artifact(content: &str) -> Result<DomainClassArtifact> {
    let sanitized = strip_think_blocks(content);

    if let Ok(artifact) = serde_json::from_str::<DomainClassArtifact>(&sanitized) {
        return Ok(artifact);
    }

    if let Some(candidate) = extract_last_json_object(&sanitized) {
        if let Ok(artifact) = serde_json::from_str::<DomainClassArtifact>(candidate) {
            return Ok(artifact);
        }
    }

    anyhow::bail!(
        "domain class llm did not return valid json; raw_content={}",
        truncate_text(content, 500)
    )
}

fn strip_think_blocks(input: &str) -> String {
    let mut output = input.to_string();

    while let Some(start) = output.find("<think>") {
        let Some(end_relative) = output[start..].find("</think>") else {
            output.replace_range(start.., "");
            break;
        };
        let end = start + end_relative + "</think>".len();
        output.replace_range(start..end, "");
    }

    output.trim().to_string()
}

fn extract_last_json_object(input: &str) -> Option<&str> {
    let bytes = input.as_bytes();
    let mut depth = 0usize;
    let mut start = None;
    let mut last = None;

    for (idx, byte) in bytes.iter().enumerate() {
        match byte {
            b'{' => {
                if depth == 0 {
                    start = Some(idx);
                }
                depth += 1;
            }
            b'}' => {
                if depth == 0 {
                    continue;
                }
                depth -= 1;
                if depth == 0 {
                    if let Some(begin) = start {
                        last = Some(&input[begin..=idx]);
                    }
                    start = None;
                }
            }
            _ => {}
        }
    }

    last
}

fn push_fact_candidate(
    candidates: &mut Vec<FactCandidate>,
    seen: &mut HashSet<String>,
    candidate: Option<FactCandidate>,
) {
    let Some(candidate) = candidate else {
        return;
    };

    let dedupe_key = format!(
        "{}::{}",
        candidate.fact_type.to_lowercase(),
        candidate.fact_text.to_lowercase()
    );
    if seen.insert(dedupe_key) {
        candidates.push(candidate);
    }
}

fn build_summary_uri(tenant_id: &str, session_id: Uuid, version: i32) -> String {
    format!(
        "memory-summary://tenants/{tenant_id}/sessions/{session_id}/versions/{version}"
    )
}

fn truncate_text(input: &str, limit: usize) -> String {
    let trimmed = input.trim();
    if trimmed.chars().count() <= limit {
        return trimmed.to_string();
    }

    let truncated: String = trimmed.chars().take(limit.saturating_sub(3)).collect();
    format!("{truncated}...")
}

fn normalize_strategy(strategy: String) -> String {
    let trimmed = strategy.trim();
    if trimmed.is_empty() {
        DEFAULT_STRATEGY.to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(not(test))]
fn maybe_inject_test_failure(_strategy: &str, _request_id: &str, _stage: &str) -> Result<()> {
    Ok(())
}

#[cfg(test)]
fn maybe_inject_test_failure(strategy: &str, request_id: &str, stage: &str) -> Result<()> {
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};

    static FAIL_ONCE_TRACKER: OnceLock<Mutex<HashMap<String, usize>>> = OnceLock::new();

    let tracker = FAIL_ONCE_TRACKER.get_or_init(|| Mutex::new(HashMap::new()));
    let key = format!("{request_id}:{stage}");

    if strategy == format!("test-fail-{stage}-always") {
        anyhow::bail!("injected test failure for {stage}");
    }

    if strategy == format!("test-fail-{stage}-once") {
        let mut guard = tracker.lock().expect("test failure tracker lock");
        let counter = guard.entry(key).or_insert(0);
        if *counter == 0 {
            *counter += 1;
            anyhow::bail!("injected single test failure for {stage}");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn summary_config_for_tests() -> SummarySection {
        SummarySection {
            async_enabled: true,
            llm_enabled: false,
            llm_provider: "minimax".to_string(),
            llm_api_key: String::new(),
            llm_base_url: "https://api.minimax.chat/v1".to_string(),
            llm_model: "MiniMax-M2.5".to_string(),
            llm_timeout_ms: 15_000,
            llm_max_concurrency: 1,
        }
    }

    #[test]
    fn build_summary_uri_formats_stably() {
        let uri = build_summary_uri(
            "tenant-1",
            Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap(),
            3,
        );
        assert_eq!(
            uri,
            "memory-summary://tenants/tenant-1/sessions/550e8400-e29b-41d4-a716-446655440000/versions/3"
        );
    }

    #[tokio::test]
    async fn build_fact_candidates_fails_when_llm_disabled() {
        let transcript = vec!["user: extract people from this transcript".to_string()];

        let result = build_fact_candidates(
            &transcript,
            Some("People session"),
            domain_class::CHAT,
            &summary_config_for_tests(),
            Arc::new(Semaphore::new(1)),
        )
        .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn build_fact_candidates_fails_when_api_key_missing() {
        let transcript = vec!["user: extract people from this transcript".to_string()];
        let mut cfg = summary_config_for_tests();
        cfg.llm_enabled = true;
        cfg.llm_api_key = String::new();

        let result = build_fact_candidates(
            &transcript,
            Some("People session"),
            domain_class::CHAT,
            &cfg,
            Arc::new(Semaphore::new(1)),
        )
        .await;

        assert!(result.is_err());
    }

}
