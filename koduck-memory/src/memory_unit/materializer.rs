use anyhow::Result;
use sqlx::PgPool;
use uuid::Uuid;

use crate::facts::MemoryFact;
use crate::memory_anchor::{
    InsertMemoryUnitAnchor,
    MemoryUnitAnchorRepository,
    MemoryUnitAnchorType,
};
use crate::memory_unit::{
    InsertMemoryUnit,
    MemoryUnitKind,
    MemoryUnitRepository,
    MemoryUnitSummaryState,
};
use crate::retrieve::infer_discourse_actions;

const DEFAULT_SNIPPET_LIMIT: usize = 96;

#[derive(Debug, Clone)]
pub struct AppendedEntryUnit {
    pub entry_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub sequence_num: i64,
    pub content: String,
    pub source_uri: String,
    pub message_ts: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone)]
pub struct SummaryUnitInput {
    pub tenant_id: String,
    pub session_id: Uuid,
    pub domain_class: String,
    pub summary: String,
    pub snippet: String,
    pub source_uri: String,
    pub entry_range_start: i64,
    pub entry_range_end: i64,
    pub time_bucket: String,
}

#[derive(Debug, Clone)]
pub struct FactUnitInput {
    pub tenant_id: String,
    pub session_id: Uuid,
    pub domain_class: String,
    pub fact: MemoryFact,
    pub entry_range_start: i64,
    pub entry_range_end: i64,
    pub time_bucket: String,
}

#[derive(Clone)]
pub struct MemoryUnitMaterializer {
    unit_repo: MemoryUnitRepository,
    anchor_repo: MemoryUnitAnchorRepository,
}

impl MemoryUnitMaterializer {
    pub fn new(pool: &PgPool) -> Self {
        Self {
            unit_repo: MemoryUnitRepository::new(pool),
            anchor_repo: MemoryUnitAnchorRepository::new(pool),
        }
    }

    pub async fn materialize_appended_entries(&self, entries: &[AppendedEntryUnit]) -> Result<()> {
        for entry in entries {
            let insert = InsertMemoryUnit::new(
                entry.tenant_id.clone(),
                entry.session_id,
                entry.sequence_num,
                entry.sequence_num,
                entry.source_uri.clone(),
            )?
            .with_memory_unit_id(entry.entry_id)
            .with_snippet(truncate_text(&entry.content, DEFAULT_SNIPPET_LIMIT))
            .with_time_bucket(build_time_bucket(entry.message_ts));

            let unit = self.unit_repo.insert(&insert).await?;
            self.insert_discourse_action_anchors(&entry.tenant_id, unit.memory_unit_id, &entry.content)
                .await?;
        }

        Ok(())
    }

    pub async fn upsert_summary_unit(&self, input: &SummaryUnitInput) -> Result<()> {
        let insert = InsertMemoryUnit::new(
            input.tenant_id.clone(),
            input.session_id,
            input.entry_range_start,
            input.entry_range_end,
            input.source_uri.clone(),
        )?
        .with_memory_unit_id(input.session_id)
        .with_memory_kind(MemoryUnitKind::Summary)
        .with_summary_state(MemoryUnitSummaryState::ready(input.summary.clone())?)
        .with_snippet(truncate_text(&input.snippet, DEFAULT_SNIPPET_LIMIT))
        .with_time_bucket(input.time_bucket.clone());

        let _ = self.unit_repo.upsert(&insert).await?;
        self.anchor_repo
            .delete_by_memory_unit(&input.tenant_id, input.session_id)
            .await?;
        self.anchor_repo
            .insert(
                &InsertMemoryUnitAnchor::new(
                    input.tenant_id.clone(),
                    input.session_id,
                    MemoryUnitAnchorType::Domain,
                    input.domain_class.clone(),
                )?,
            )
            .await?;
        self.insert_discourse_action_anchors(&input.tenant_id, input.session_id, &input.summary)
            .await?;
        self.unit_repo
            .sync_projected_domain_class_primary(&input.tenant_id, input.session_id)
            .await?;
        Ok(())
    }

    pub async fn replace_fact_units(&self, inputs: &[FactUnitInput]) -> Result<()> {
        if inputs.is_empty() {
            return Ok(());
        }

        let tenant_id = &inputs[0].tenant_id;
        let session_id = inputs[0].session_id;
        let existing = self
            .unit_repo
            .list_by_session_and_kind(tenant_id, session_id, MemoryUnitKind::Fact)
            .await?;

        for unit in existing {
            self.anchor_repo
                .delete_by_memory_unit(tenant_id, unit.memory_unit_id)
                .await?;
            self.unit_repo.delete_by_id(tenant_id, unit.memory_unit_id).await?;
        }

        for input in inputs {
            let insert = InsertMemoryUnit::new(
                input.tenant_id.clone(),
                input.session_id,
                input.entry_range_start,
                input.entry_range_end,
                build_fact_uri(&input.tenant_id, input.session_id, input.fact.id),
            )?
            .with_memory_unit_id(input.fact.id)
            .with_memory_kind(MemoryUnitKind::Fact)
            .with_summary_state(MemoryUnitSummaryState::pending())
            .with_snippet(truncate_text(&input.fact.fact_text, DEFAULT_SNIPPET_LIMIT))
            .with_time_bucket(input.time_bucket.clone());

            let unit = self.unit_repo.insert(&insert).await?;
            self.anchor_repo
                .insert(
                    &InsertMemoryUnitAnchor::new(
                        input.tenant_id.clone(),
                        unit.memory_unit_id,
                        MemoryUnitAnchorType::Domain,
                        input.domain_class.clone(),
                    )?,
                )
                .await?;
            self.anchor_repo
                .insert(
                    &InsertMemoryUnitAnchor::new(
                        input.tenant_id.clone(),
                        unit.memory_unit_id,
                        MemoryUnitAnchorType::FactType,
                        input.fact.fact_type.clone(),
                    )?
                    .with_anchor_value(input.fact.fact_text.clone())
                    .with_weight(input.fact.confidence)?,
                )
                .await?;
            self.insert_discourse_action_anchors(
                &input.tenant_id,
                unit.memory_unit_id,
                &input.fact.fact_text,
            )
            .await?;
            self.unit_repo
                .sync_projected_domain_class_primary(&input.tenant_id, unit.memory_unit_id)
                .await?;
        }

        Ok(())
    }

    async fn insert_discourse_action_anchors(
        &self,
        tenant_id: &str,
        memory_unit_id: Uuid,
        source_text: &str,
    ) -> Result<()> {
        for discourse_action in infer_discourse_actions(source_text) {
            self.anchor_repo
                .insert(
                    &InsertMemoryUnitAnchor::new(
                        tenant_id.to_string(),
                        memory_unit_id,
                        MemoryUnitAnchorType::DiscourseAction,
                        discourse_action.as_str(),
                    )?,
                )
                .await?;
        }

        Ok(())
    }
}

fn truncate_text(input: &str, limit: usize) -> String {
    let trimmed = input.trim();
    if trimmed.chars().count() <= limit {
        return trimmed.to_string();
    }

    let truncated: String = trimmed.chars().take(limit.saturating_sub(3)).collect();
    format!("{truncated}...")
}

fn build_time_bucket(timestamp: chrono::DateTime<chrono::Utc>) -> String {
    timestamp.format("%Y-%m").to_string()
}

fn build_fact_uri(tenant_id: &str, session_id: Uuid, fact_id: Uuid) -> String {
    format!("memory-fact://tenants/{tenant_id}/sessions/{session_id}/facts/{fact_id}")
}
