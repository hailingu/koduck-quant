use anyhow::{Result, bail};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MemoryUnitKind {
    GenericConversation,
    Summary,
    Fact,
}

impl MemoryUnitKind {
    pub fn from_db_value(value: Option<&str>) -> Result<Self> {
        match value {
            None => Ok(Self::GenericConversation),
            Some("summary") => Ok(Self::Summary),
            Some("fact") => Ok(Self::Fact),
            Some(other) => bail!("unsupported memory_unit.memory_kind: {other}"),
        }
    }

    pub fn as_db_value(&self) -> Option<&'static str> {
        match self {
            Self::GenericConversation => None,
            Self::Summary => Some("summary"),
            Self::Fact => Some("fact"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SummaryPayload {
    Raw,
    Ready(String),
    Failed(Option<String>),
    NotApplicable,
    LegacyPending,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MemoryUnitSummaryState {
    pub summary_status: String,
    pub summary: Option<String>,
}

impl MemoryUnitSummaryState {
    pub fn raw() -> Self {
        Self {
            summary_status: "raw".to_string(),
            summary: None,
        }
    }

    pub fn pending() -> Self {
        Self::raw()
    }

    pub fn ready(summary: impl Into<String>) -> Result<Self> {
        let summary = summary.into();
        if summary.trim().is_empty() {
            bail!("summary_status=ready requires a non-empty summary");
        }

        Ok(Self {
            summary_status: "ready".to_string(),
            summary: Some(summary),
        })
    }

    pub fn failed(summary: Option<String>) -> Self {
        Self {
            summary_status: "failed".to_string(),
            summary,
        }
    }

    pub fn not_applicable() -> Self {
        Self {
            summary_status: "not_applicable".to_string(),
            summary: None,
        }
    }

    pub fn payload(&self) -> Result<SummaryPayload> {
        match self.summary_status.as_str() {
            "raw" => {
                if self.summary.is_some() {
                    bail!("summary_status=raw must not carry a summary payload");
                }
                Ok(SummaryPayload::Raw)
            }
            "pending" => {
                if self.summary.is_some() {
                    bail!("summary_status=pending must not carry a summary payload");
                }
                Ok(SummaryPayload::LegacyPending)
            }
            "ready" => {
                let summary = self
                    .summary
                    .clone()
                    .ok_or_else(|| anyhow::anyhow!("summary_status=ready requires summary"))?;
                if summary.trim().is_empty() {
                    bail!("summary_status=ready requires a non-empty summary");
                }
                Ok(SummaryPayload::Ready(summary))
            }
            "failed" => Ok(SummaryPayload::Failed(self.summary.clone())),
            "not_applicable" => {
                if self.summary.is_some() {
                    bail!("summary_status=not_applicable must not carry a summary payload");
                }
                Ok(SummaryPayload::NotApplicable)
            }
            other => bail!("unsupported summary_status: {other}"),
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct MemoryUnitRow {
    pub memory_unit_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub entry_range_start: i64,
    pub entry_range_end: i64,
    pub memory_kind: Option<String>,
    pub domain_class_primary: Option<String>,
    pub summary: Option<String>,
    pub source_uri: String,
    pub summary_status: String,
    pub salience_score: Option<f64>,
    pub time_bucket: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryUnit {
    pub memory_unit_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub entry_range_start: i64,
    pub entry_range_end: i64,
    pub memory_kind: MemoryUnitKind,
    pub domain_class_primary: Option<String>,
    pub summary_state: MemoryUnitSummaryState,
    pub source_uri: String,
    pub salience_score: Option<f64>,
    pub time_bucket: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl TryFrom<MemoryUnitRow> for MemoryUnit {
    type Error = anyhow::Error;

    fn try_from(row: MemoryUnitRow) -> Result<Self> {
        if row.entry_range_end < row.entry_range_start {
            bail!("entry_range_end must be >= entry_range_start");
        }

        if row.source_uri.trim().is_empty() {
            bail!("source_uri must not be blank");
        }

        Ok(Self {
            memory_unit_id: row.memory_unit_id,
            tenant_id: row.tenant_id,
            session_id: row.session_id,
            entry_range_start: row.entry_range_start,
            entry_range_end: row.entry_range_end,
            memory_kind: MemoryUnitKind::from_db_value(row.memory_kind.as_deref())?,
            domain_class_primary: row.domain_class_primary,
            summary_state: {
                let state = MemoryUnitSummaryState {
                    summary_status: row.summary_status,
                    summary: row.summary,
                };
                let _ = state.payload()?;
                state
            },
            source_uri: row.source_uri,
            salience_score: row.salience_score,
            time_bucket: row.time_bucket,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Debug, Clone)]
pub struct InsertMemoryUnit {
    pub memory_unit_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub entry_range_start: i64,
    pub entry_range_end: i64,
    pub memory_kind: MemoryUnitKind,
    pub domain_class_primary: Option<String>,
    pub summary_state: MemoryUnitSummaryState,
    pub source_uri: String,
    pub salience_score: Option<f64>,
    pub time_bucket: Option<String>,
}

impl InsertMemoryUnit {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        entry_range_start: i64,
        entry_range_end: i64,
        source_uri: impl Into<String>,
    ) -> Result<Self> {
        let source_uri = source_uri.into();
        if entry_range_end < entry_range_start {
            bail!("entry_range_end must be >= entry_range_start");
        }
        if source_uri.trim().is_empty() {
            bail!("source_uri must not be blank");
        }

        Ok(Self {
            memory_unit_id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            session_id,
            entry_range_start,
            entry_range_end,
            memory_kind: MemoryUnitKind::GenericConversation,
            domain_class_primary: None,
            summary_state: MemoryUnitSummaryState::raw(),
            source_uri,
            salience_score: None,
            time_bucket: None,
        })
    }

    pub fn with_memory_kind(mut self, memory_kind: MemoryUnitKind) -> Self {
        self.memory_kind = memory_kind;
        self
    }

    pub fn with_memory_unit_id(mut self, memory_unit_id: Uuid) -> Self {
        self.memory_unit_id = memory_unit_id;
        self
    }

    pub fn with_domain_class_primary(mut self, domain_class_primary: impl Into<String>) -> Self {
        self.domain_class_primary = Some(domain_class_primary.into());
        self
    }

    pub fn with_summary_state(mut self, summary_state: MemoryUnitSummaryState) -> Self {
        self.summary_state = summary_state;
        self
    }

    pub fn with_salience_score(mut self, salience_score: f64) -> Self {
        self.salience_score = Some(salience_score);
        self
    }

    pub fn with_time_bucket(mut self, time_bucket: impl Into<String>) -> Self {
        self.time_bucket = Some(time_bucket.into());
        self
    }

    pub fn validate(&self) -> Result<()> {
        let _ = self.summary_state.payload()?;
        if self.source_uri.trim().is_empty() {
            bail!("source_uri must not be blank");
        }
        if self.entry_range_end < self.entry_range_start {
            bail!("entry_range_end must be >= entry_range_start");
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "../tests/memory_unit/model_tests.rs"]
mod tests;
