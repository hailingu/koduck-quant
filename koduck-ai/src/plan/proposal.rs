use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProposalTargetKind {
    Memory,
    Knowledge,
}

impl ProposalTargetKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Memory => "memory",
            Self::Knowledge => "knowledge",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProposalOperation {
    Append,
    Update,
    Delete,
    Merge,
}

impl ProposalOperation {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Append => "append",
            Self::Update => "update",
            Self::Delete => "delete",
            Self::Merge => "merge",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProposalStatus {
    Proposed,
    Approved,
    Rejected,
    Edited,
    Applied,
}

impl ProposalStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Proposed => "proposed",
            Self::Approved => "approved",
            Self::Rejected => "rejected",
            Self::Edited => "edited",
            Self::Applied => "applied",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Proposal {
    pub proposal_id: String,
    pub tenant_id: String,
    pub session_id: String,
    pub plan_id: String,
    pub node_id: Option<String>,
    pub target_kind: ProposalTargetKind,
    pub operation: ProposalOperation,
    pub target_ref: Option<String>,
    pub before_json: Option<Value>,
    pub after_json: Value,
    pub reason: Option<String>,
    pub confidence: Option<f64>,
    pub status: ProposalStatus,
    pub created_by: Option<String>,
    pub reviewed_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub applied_at: Option<DateTime<Utc>>,
}
