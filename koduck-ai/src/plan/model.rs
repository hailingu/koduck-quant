use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::plan::node::PlanNode;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanStatus {
    Draft,
    Running,
    WaitingApproval,
    Completed,
    Failed,
    Cancelled,
}

impl PlanStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Running => "running",
            Self::WaitingApproval => "waiting_approval",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Plan {
    pub plan_id: String,
    pub tenant_id: String,
    pub session_id: String,
    pub request_id: String,
    pub goal: String,
    pub status: PlanStatus,
    pub created_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub nodes: Vec<PlanNode>,
}

impl Plan {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: impl Into<String>,
        request_id: impl Into<String>,
        goal: impl Into<String>,
        created_by: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            plan_id: uuid::Uuid::new_v4().to_string(),
            tenant_id: tenant_id.into(),
            session_id: session_id.into(),
            request_id: request_id.into(),
            goal: goal.into(),
            status: PlanStatus::Draft,
            created_by,
            created_at: now,
            updated_at: now,
            nodes: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Artifact {
    pub artifact_id: String,
    pub tenant_id: String,
    pub session_id: String,
    pub plan_id: String,
    pub node_id: Option<String>,
    pub artifact_type: String,
    pub content_json: Option<Value>,
    pub object_uri: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
#[path = "../tests/plan/model_tests.rs"]
mod tests;
