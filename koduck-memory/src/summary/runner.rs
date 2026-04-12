use sqlx::PgPool;
use tracing::{info, instrument};
use uuid::Uuid;

use crate::index::{InsertMemoryIndexRecord, MemoryIndexRepository};
use crate::memory::MemoryEntryRepository;
use crate::retrieve::domain_class;
use crate::session::SessionRepository;
use crate::store::ObjectStoreClient;
use crate::summary::{InsertMemorySummary, MemorySummary, MemorySummaryRepository};
use crate::Result;

const DEFAULT_STRATEGY: &str = "session-rollup";
const MAX_SUMMARY_INPUTS: usize = 6;
const MAX_SNIPPET_CHARS: usize = 220;
const MAX_SUMMARY_CHARS: usize = 1_200;

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
    index_repo: MemoryIndexRepository,
    object_store: Option<ObjectStoreClient>,
}

impl SummaryTaskRunner {
    pub fn new(pool: &PgPool, object_store: Option<ObjectStoreClient>) -> Self {
        Self {
            entry_repo: MemoryEntryRepository::new(pool),
            session_repo: SessionRepository::new(pool),
            summary_repo: MemorySummaryRepository::new(pool),
            index_repo: MemoryIndexRepository::new(pool),
            object_store,
        }
    }

    #[instrument(skip(self), fields(tenant_id = %job.tenant_id, session_id = %job.session_id, strategy = %job.strategy, request_id = %job.request_id))]
    pub async fn run(&self, job: SummaryJob) -> Result<MemorySummary> {
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

        let insert_summary = InsertMemorySummary::new(
            job.tenant_id.clone(),
            job.session_id,
            inferred_domain_class.clone(),
            summary_text.clone(),
            job.strategy.clone(),
            version,
        );
        let stored = self.summary_repo.insert(&insert_summary).await?;

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

        info!(
            summary_id = %stored.id,
            version = stored.version,
            domain_class = %stored.domain_class,
            "summary task completed"
        );

        Ok(stored)
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
}
