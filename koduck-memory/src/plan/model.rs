use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::api::{
    EditProposalInfo, PlanArtifactInfo, PlanEventInfo, PlanInfo, PlanSnapshotInfo,
};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Plan {
    pub plan_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub request_id: String,
    pub goal: String,
    pub status: String,
    pub created_by: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl Plan {
    pub fn to_proto(&self) -> PlanInfo {
        PlanInfo {
            plan_id: self.plan_id.to_string(),
            tenant_id: self.tenant_id.clone(),
            session_id: self.session_id.to_string(),
            request_id: self.request_id.clone(),
            goal: self.goal.clone(),
            status: self.status.clone(),
            created_by: self.created_by.clone().unwrap_or_default(),
            created_at: self.created_at.timestamp_millis(),
            updated_at: self.updated_at.timestamp_millis(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CreatePlan {
    pub plan_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub request_id: String,
    pub goal: String,
    pub status: String,
    pub created_by: Option<String>,
}

impl CreatePlan {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        request_id: impl Into<String>,
        goal: impl Into<String>,
        created_by: Option<String>,
    ) -> Self {
        Self {
            plan_id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            session_id,
            request_id: request_id.into(),
            goal: goal.into(),
            status: "draft".to_string(),
            created_by,
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct PlanEvent {
    pub event_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub plan_id: Uuid,
    pub sequence_num: i64,
    pub event_type: String,
    pub payload_json: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl PlanEvent {
    pub fn to_proto(&self) -> PlanEventInfo {
        PlanEventInfo {
            event_id: self.event_id.to_string(),
            tenant_id: self.tenant_id.clone(),
            session_id: self.session_id.to_string(),
            plan_id: self.plan_id.to_string(),
            sequence_num: self.sequence_num,
            event_type: self.event_type.clone(),
            payload_json: self.payload_json.to_string(),
            created_at: self.created_at.timestamp_millis(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct InsertPlanEvent {
    pub event_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub plan_id: Uuid,
    pub sequence_num: i64,
    pub event_type: String,
    pub payload_json: serde_json::Value,
}

impl InsertPlanEvent {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        plan_id: Uuid,
        sequence_num: i64,
        event_type: impl Into<String>,
        payload_json: serde_json::Value,
    ) -> Self {
        Self {
            event_id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            session_id,
            plan_id,
            sequence_num,
            event_type: event_type.into(),
            payload_json,
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct PlanSnapshot {
    pub snapshot_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub plan_id: Uuid,
    pub version: i64,
    pub state_json: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl PlanSnapshot {
    pub fn to_proto(&self) -> PlanSnapshotInfo {
        PlanSnapshotInfo {
            snapshot_id: self.snapshot_id.to_string(),
            tenant_id: self.tenant_id.clone(),
            session_id: self.session_id.to_string(),
            plan_id: self.plan_id.to_string(),
            version: self.version,
            state_json: self.state_json.to_string(),
            created_at: self.created_at.timestamp_millis(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SavePlanSnapshot {
    pub snapshot_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub plan_id: Uuid,
    pub version: i64,
    pub state_json: serde_json::Value,
}

impl SavePlanSnapshot {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        plan_id: Uuid,
        version: i64,
        state_json: serde_json::Value,
    ) -> Self {
        Self {
            snapshot_id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            session_id,
            plan_id,
            version,
            state_json,
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct PlanArtifact {
    pub artifact_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub plan_id: Uuid,
    pub node_id: Option<String>,
    pub artifact_type: String,
    pub content_json: Option<serde_json::Value>,
    pub object_uri: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl PlanArtifact {
    pub fn to_proto(&self) -> PlanArtifactInfo {
        PlanArtifactInfo {
            artifact_id: self.artifact_id.to_string(),
            tenant_id: self.tenant_id.clone(),
            session_id: self.session_id.to_string(),
            plan_id: self.plan_id.to_string(),
            node_id: self.node_id.clone().unwrap_or_default(),
            artifact_type: self.artifact_type.clone(),
            content_json: self
                .content_json
                .as_ref()
                .map(serde_json::Value::to_string)
                .unwrap_or_default(),
            object_uri: self.object_uri.clone().unwrap_or_default(),
            created_at: self.created_at.timestamp_millis(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct InsertPlanArtifact {
    pub artifact_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub plan_id: Uuid,
    pub node_id: Option<String>,
    pub artifact_type: String,
    pub content_json: Option<serde_json::Value>,
    pub object_uri: Option<String>,
}

impl InsertPlanArtifact {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        plan_id: Uuid,
        artifact_type: impl Into<String>,
    ) -> Self {
        Self {
            artifact_id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            session_id,
            plan_id,
            node_id: None,
            artifact_type: artifact_type.into(),
            content_json: None,
            object_uri: None,
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct EditProposal {
    pub proposal_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub plan_id: Uuid,
    pub node_id: Option<String>,
    pub target_kind: String,
    pub operation: String,
    pub target_ref: Option<String>,
    pub before_json: Option<serde_json::Value>,
    pub after_json: serde_json::Value,
    pub reason: Option<String>,
    pub confidence: Option<f64>,
    pub status: String,
    pub created_by: Option<String>,
    pub reviewed_by: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub reviewed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub applied_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl EditProposal {
    pub fn to_proto(&self) -> EditProposalInfo {
        EditProposalInfo {
            proposal_id: self.proposal_id.to_string(),
            tenant_id: self.tenant_id.clone(),
            session_id: self.session_id.to_string(),
            plan_id: self.plan_id.to_string(),
            node_id: self.node_id.clone().unwrap_or_default(),
            target_kind: self.target_kind.clone(),
            operation: self.operation.clone(),
            target_ref: self.target_ref.clone().unwrap_or_default(),
            before_json: self
                .before_json
                .as_ref()
                .map(serde_json::Value::to_string)
                .unwrap_or_default(),
            after_json: self.after_json.to_string(),
            reason: self.reason.clone().unwrap_or_default(),
            confidence: self.confidence.unwrap_or_default(),
            status: self.status.clone(),
            created_by: self.created_by.clone().unwrap_or_default(),
            reviewed_by: self.reviewed_by.clone().unwrap_or_default(),
            created_at: self.created_at.timestamp_millis(),
            reviewed_at: self
                .reviewed_at
                .map(|value| value.timestamp_millis())
                .unwrap_or_default(),
            applied_at: self
                .applied_at
                .map(|value| value.timestamp_millis())
                .unwrap_or_default(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CreateEditProposal {
    pub proposal_id: Uuid,
    pub tenant_id: String,
    pub session_id: Uuid,
    pub plan_id: Uuid,
    pub node_id: Option<String>,
    pub target_kind: String,
    pub operation: String,
    pub target_ref: Option<String>,
    pub before_json: Option<serde_json::Value>,
    pub after_json: serde_json::Value,
    pub reason: Option<String>,
    pub confidence: Option<f64>,
    pub created_by: Option<String>,
}

impl CreateEditProposal {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        plan_id: Uuid,
        target_kind: impl Into<String>,
        operation: impl Into<String>,
        after_json: serde_json::Value,
    ) -> Self {
        Self {
            proposal_id: Uuid::new_v4(),
            tenant_id: tenant_id.into(),
            session_id,
            plan_id,
            node_id: None,
            target_kind: target_kind.into(),
            operation: operation.into(),
            target_ref: None,
            before_json: None,
            after_json,
            reason: None,
            confidence: None,
            created_by: None,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ReviewEditProposal {
    pub tenant_id: String,
    pub session_id: Uuid,
    pub proposal_id: Uuid,
    pub status: String,
    pub reviewed_by: String,
    pub after_json: Option<serde_json::Value>,
    pub applied: bool,
}

impl ReviewEditProposal {
    pub fn approve(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        proposal_id: Uuid,
        reviewed_by: impl Into<String>,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            session_id,
            proposal_id,
            status: "approved".to_string(),
            reviewed_by: reviewed_by.into(),
            after_json: None,
            applied: false,
        }
    }

    pub fn reject(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        proposal_id: Uuid,
        reviewed_by: impl Into<String>,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            session_id,
            proposal_id,
            status: "rejected".to_string(),
            reviewed_by: reviewed_by.into(),
            after_json: None,
            applied: false,
        }
    }

    pub fn edit(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        proposal_id: Uuid,
        reviewed_by: impl Into<String>,
        after_json: serde_json::Value,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            session_id,
            proposal_id,
            status: "edited".to_string(),
            reviewed_by: reviewed_by.into(),
            after_json: Some(after_json),
            applied: false,
        }
    }

    pub fn edit_and_approve(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        proposal_id: Uuid,
        reviewed_by: impl Into<String>,
        after_json: serde_json::Value,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            session_id,
            proposal_id,
            status: "approved".to_string(),
            reviewed_by: reviewed_by.into(),
            after_json: Some(after_json),
            applied: false,
        }
    }

    pub fn apply(
        tenant_id: impl Into<String>,
        session_id: Uuid,
        proposal_id: Uuid,
        reviewed_by: impl Into<String>,
    ) -> Self {
        Self {
            tenant_id: tenant_id.into(),
            session_id,
            proposal_id,
            status: "applied".to_string(),
            reviewed_by: reviewed_by.into(),
            after_json: None,
            applied: true,
        }
    }
}

#[cfg(test)]
#[path = "../tests/plan/model_tests.rs"]
mod tests;
