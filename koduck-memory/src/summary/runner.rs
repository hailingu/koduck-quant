use std::collections::HashSet;

use sqlx::PgPool;
use tracing::{info, instrument, warn};
use uuid::Uuid;

use crate::config::RetrySection;
use crate::facts::{InsertMemoryFact, MemoryFact, MemoryFactRepository};
use crate::index::{InsertMemoryIndexRecord, MemoryIndexRepository};
use crate::memory::MemoryEntryRepository;
use crate::reliability::{TaskAttemptRepository, with_retry};
use crate::retrieve::domain_class;
use crate::session::SessionRepository;
use crate::store::ObjectStoreClient;
use crate::summary::{InsertMemorySummary, MemorySummary, MemorySummaryRepository};
use crate::Result;

const DEFAULT_STRATEGY: &str = "session-rollup";
const MAX_SUMMARY_INPUTS: usize = 6;
const MAX_SNIPPET_CHARS: usize = 220;
const MAX_SUMMARY_CHARS: usize = 1_200;
const MAX_FACT_CHARS: usize = 220;
const MAX_FACTS_PER_RUN: usize = 3;

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
    object_store: Option<ObjectStoreClient>,
    retry_config: RetrySection,
}

impl SummaryTaskRunner {
    pub fn new(
        pool: &PgPool,
        object_store: Option<ObjectStoreClient>,
        retry_config: RetrySection,
    ) -> Self {
        Self {
            entry_repo: MemoryEntryRepository::new(pool),
            session_repo: SessionRepository::new(pool),
            summary_repo: MemorySummaryRepository::new(pool),
            fact_repo: MemoryFactRepository::new(pool),
            attempt_repo: TaskAttemptRepository::new(pool),
            index_repo: MemoryIndexRepository::new(pool),
            object_store,
            retry_config,
        }
    }

    #[instrument(skip(self), fields(tenant_id = %job.tenant_id, session_id = %job.session_id, strategy = %job.strategy, request_id = %job.request_id))]
    pub async fn run(&self, job: SummaryJob) -> Result<MemorySummary> {
        let materialized = with_retry(
            "summary_materialize",
            &job.tenant_id,
            job.session_id,
            &job.request_id,
            &self.attempt_repo,
            &self.retry_config,
            || {
                let runner = self.clone();
                let job = job.clone();
                async move { runner.materialize_summary(job).await }
            },
        )
        .await?;

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

        if materialized.has_fact_candidates() {
            if let Err(error) = with_retry(
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
            fact_count = materialized.fact_candidates.len(),
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
        let inferred_domain_class =
            infer_domain_class(&transcript, session.as_ref().map(|s| s.title.as_str()));
        let summary_text = build_summary_text(
            &transcript,
            entries.len(),
            session.as_ref().map(|s| s.title.as_str()),
            &inferred_domain_class,
        );
        let version = self.summary_repo.next_version(&job.tenant_id, job.session_id).await?;

        maybe_inject_test_failure(&job.strategy, &job.request_id, "summary_materialize")?;

        let insert_summary = InsertMemorySummary::new(
            job.tenant_id.clone(),
            job.session_id,
            inferred_domain_class.clone(),
            summary_text,
            job.strategy.clone(),
            version,
        );
        let stored = self.summary_repo.insert(&insert_summary).await?;

        let fact_candidates = build_fact_candidates(
            &transcript,
            session.as_ref().map(|value| value.title.as_str()),
            &stored.domain_class,
        );

        Ok(SummaryMaterialization {
            stored_summary: stored,
            fact_candidates,
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
        let summary_uri = build_summary_uri(&stored.tenant_id, stored.session_id, stored.version);
        let index_record = InsertMemoryIndexRecord::new(
            stored.tenant_id.clone(),
            stored.session_id,
            "summary",
            stored.domain_class.clone(),
            stored.summary.clone(),
            summary_uri,
        )
        .with_snippet(build_snippet(&stored.summary))
        .with_score_hint("0.95");
        self.index_repo.insert(&index_record).await?;
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

        let mut facts = Vec::with_capacity(materialized.fact_candidates.len());
        for candidate in &materialized.fact_candidates {
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
        Ok(facts)
    }
}

async fn build_transcript_fragments(
    entries: &[crate::memory::MemoryEntry],
    object_store: Option<&ObjectStoreClient>,
) -> Vec<String> {
    let start = entries.len().saturating_sub(MAX_SUMMARY_INPUTS);
    let mut fragments = Vec::new();

    for entry in &entries[start..] {
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
                format!("{}: {}", entry.role, truncate_text(&content, 140))
            }
            _ => format!("{} message #{}", entry.role, entry.sequence_num),
        };
        fragments.push(fragment);
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
    fact_candidates: Vec<FactCandidate>,
    request_id: String,
    test_strategy: String,
}

impl SummaryMaterialization {
    fn has_fact_candidates(&self) -> bool {
        !self.fact_candidates.is_empty()
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

fn build_summary_text(
    transcript: &[String],
    entry_count: usize,
    session_title: Option<&str>,
    inferred_domain_class: &str,
) -> String {
    let title_prefix = session_title
        .filter(|title| !title.trim().is_empty())
        .map(|title| format!("Session '{title}'"))
        .unwrap_or_else(|| "Session".to_string());

    if transcript.is_empty() {
        return format!(
            "{title_prefix} produced an asynchronous summary with {entry_count} stored messages. The dominant domain class is {inferred_domain_class}."
        );
    }

    let joined = transcript.join(" | ");
    truncate_text(
        &format!(
            "{title_prefix} summary ({inferred_domain_class}, {entry_count} messages): {joined}"
        ),
        MAX_SUMMARY_CHARS,
    )
}

fn infer_domain_class(transcript: &[String], session_title: Option<&str>) -> String {
    let mut corpus = transcript.join(" ").to_lowercase();
    if let Some(title) = session_title {
        corpus.push(' ');
        corpus.push_str(&title.to_lowercase());
    }

    if [
        "task",
        "todo",
        "deadline",
        "follow-up",
        "fix",
        "implement",
        "任务",
        "待办",
        "修复",
        "实现",
    ]
    .iter()
    .any(|keyword| corpus.contains(keyword))
    {
        return domain_class::TASK.to_string();
    }

    if !transcript.is_empty()
        && transcript
            .iter()
            .all(|line| line.starts_with("system:") || line.starts_with("system "))
    {
        return domain_class::SYSTEM.to_string();
    }

    domain_class::CHAT.to_string()
}

fn build_fact_candidates(
    transcript: &[String],
    session_title: Option<&str>,
    inferred_domain_class: &str,
) -> Vec<FactCandidate> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    if let Some(title) = session_title.filter(|value| !value.trim().is_empty()) {
        push_fact_candidate(
            &mut candidates,
            &mut seen,
            FactCandidate::new(
                "session_focus",
                format!("Session focus is {}.", truncate_text(title, MAX_FACT_CHARS)),
                0.70,
            ),
        );
    }

    for line in transcript {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let normalized = trimmed.to_lowercase();
        if normalized.starts_with("user:")
            && contains_any(
                &normalized,
                &[
                    "prefer",
                    "preference",
                    "like ",
                    "likes ",
                    "偏好",
                    "喜欢",
                    "习惯",
                ],
            )
        {
            let fact_text = sentence_fact("User preference", extract_fact_payload(trimmed));
            push_fact_candidate(
                &mut candidates,
                &mut seen,
                FactCandidate::new("preference", fact_text, 0.91),
            );
        } else if contains_any(
            &normalized,
            &[
                "must",
                "always",
                "never",
                "do not",
                "don't",
                "不能",
                "不要",
                "必须",
            ],
        ) {
            let fact_text = sentence_fact("Persistent constraint", extract_fact_payload(trimmed));
            push_fact_candidate(
                &mut candidates,
                &mut seen,
                FactCandidate::new("constraint", fact_text, 0.95),
            );
        } else if inferred_domain_class == domain_class::TASK
            || contains_any(
                &normalized,
                &[
                    "task",
                    "todo",
                    "follow-up",
                    "next step",
                    "deadline",
                    "待办",
                    "任务",
                    "跟进",
                ],
            )
        {
            let fact_text = sentence_fact("Open task context", extract_fact_payload(trimmed));
            push_fact_candidate(
                &mut candidates,
                &mut seen,
                FactCandidate::new("task_context", fact_text, 0.82),
            );
        }

        if candidates.len() >= MAX_FACTS_PER_RUN {
            break;
        }
    }

    candidates.truncate(MAX_FACTS_PER_RUN);
    candidates
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

fn contains_any(input: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|keyword| input.contains(keyword))
}

fn extract_fact_payload(line: &str) -> &str {
    line.split_once(':')
        .map(|(_, value)| value.trim())
        .unwrap_or_else(|| line.trim())
}

fn sentence_fact(prefix: &str, payload: &str) -> String {
    let payload = payload.trim().trim_end_matches('.');
    if payload.is_empty() {
        prefix.to_string()
    } else {
        format!("{prefix}: {payload}.")
    }
}

fn build_summary_uri(tenant_id: &str, session_id: Uuid, version: i32) -> String {
    format!(
        "memory-summary://tenants/{tenant_id}/sessions/{session_id}/versions/{version}"
    )
}

fn build_snippet(summary: &str) -> String {
    truncate_text(summary, MAX_SNIPPET_CHARS)
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

    #[test]
    fn infer_domain_class_prefers_task_keywords() {
        let transcript = vec!["user: please fix the deployment task".to_string()];
        assert_eq!(infer_domain_class(&transcript, None), domain_class::TASK);
    }

    #[test]
    fn infer_domain_class_falls_back_to_chat() {
        let transcript = vec![
            "user: hello there".to_string(),
            "assistant: happy to help".to_string(),
        ];
        assert_eq!(
            infer_domain_class(&transcript, Some("General chat")),
            domain_class::CHAT
        );
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

    #[test]
    fn build_fact_candidates_extracts_preference_and_constraint() {
        let transcript = vec![
            "user: I prefer concise rollout summaries".to_string(),
            "assistant: noted".to_string(),
            "user: Please do not post raw secrets in logs".to_string(),
        ];

        let facts = build_fact_candidates(&transcript, Some("Rollout session"), domain_class::CHAT);

        assert!(facts.iter().any(|fact| fact.fact_type == "session_focus"));
        assert!(facts.iter().any(|fact| fact.fact_type == "preference"));
        assert!(facts.iter().any(|fact| fact.fact_type == "constraint"));
    }

    #[test]
    fn build_fact_candidates_limits_and_deduplicates() {
        let transcript = vec![
            "user: todo deploy to dev".to_string(),
            "user: todo deploy to dev".to_string(),
            "assistant: follow-up on deployment task".to_string(),
            "user: another task follow-up".to_string(),
        ];

        let facts = build_fact_candidates(&transcript, None, domain_class::TASK);

        assert!(facts.len() <= MAX_FACTS_PER_RUN);
        let unique: HashSet<_> = facts
            .iter()
            .map(|fact| format!("{}::{}", fact.fact_type, fact.fact_text))
            .collect();
        assert_eq!(unique.len(), facts.len());
    }
}
