use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::stream::sse::PendingStreamEvent;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlanEventKind {
    PlanCreated,
    PlanCompleted,
    PlanUpdated,
    PlanNodeAdded,
    PlanNodeUpdated,
    PlanNodeStarted,
    PlanNodeCompleted,
    PlanNodeFailed,
    PlanNodeWaitingApproval,
    PlanPatchProposed,
    PlanPatchApplied,
    ArtifactCreated,
    MemoryPatchProposed,
    MemoryPatchApplied,
    KnowledgePatchProposed,
    KnowledgePatchApplied,
}

impl PlanEventKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::PlanCreated => "plan.created",
            Self::PlanCompleted => "plan.completed",
            Self::PlanUpdated => "plan.updated",
            Self::PlanNodeAdded => "plan.node.added",
            Self::PlanNodeUpdated => "plan.node.updated",
            Self::PlanNodeStarted => "plan.node.started",
            Self::PlanNodeCompleted => "plan.node.completed",
            Self::PlanNodeFailed => "plan.node.failed",
            Self::PlanNodeWaitingApproval => "plan.node.waiting_approval",
            Self::PlanPatchProposed => "plan.patch.proposed",
            Self::PlanPatchApplied => "plan.patch.applied",
            Self::ArtifactCreated => "artifact.created",
            Self::MemoryPatchProposed => "memory.patch.proposed",
            Self::MemoryPatchApplied => "memory.patch.applied",
            Self::KnowledgePatchProposed => "knowledge.patch.proposed",
            Self::KnowledgePatchApplied => "knowledge.patch.applied",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlanEvent {
    pub event_id: String,
    pub tenant_id: String,
    pub session_id: String,
    pub request_id: String,
    pub plan_id: String,
    pub node_id: Option<String>,
    pub sequence_num: Option<u32>,
    pub kind: PlanEventKind,
    pub payload: Value,
    pub created_at: DateTime<Utc>,
}

impl PlanEvent {
    pub fn new(
        tenant_id: impl Into<String>,
        session_id: impl Into<String>,
        request_id: impl Into<String>,
        plan_id: impl Into<String>,
        kind: PlanEventKind,
        payload: Value,
    ) -> Self {
        Self {
            event_id: uuid::Uuid::new_v4().to_string(),
            tenant_id: tenant_id.into(),
            session_id: session_id.into(),
            request_id: request_id.into(),
            plan_id: plan_id.into(),
            node_id: None,
            sequence_num: None,
            kind,
            payload,
            created_at: Utc::now(),
        }
    }

    pub fn plan_created(
        tenant_id: impl Into<String>,
        session_id: impl Into<String>,
        request_id: impl Into<String>,
        plan_id: impl Into<String>,
        goal: impl Into<String>,
    ) -> Self {
        let plan_id = plan_id.into();
        Self::new(
            tenant_id,
            session_id,
            request_id,
            plan_id.clone(),
            PlanEventKind::PlanCreated,
            json!({
                "planId": plan_id,
                "goal": goal.into(),
                "status": "draft",
            }),
        )
    }

    pub fn plan_completed(
        tenant_id: impl Into<String>,
        session_id: impl Into<String>,
        request_id: impl Into<String>,
        plan_id: impl Into<String>,
    ) -> Self {
        let plan_id = plan_id.into();
        Self::new(
            tenant_id,
            session_id,
            request_id,
            plan_id.clone(),
            PlanEventKind::PlanCompleted,
            json!({
                "planId": plan_id,
                "status": "completed",
            }),
        )
    }

    pub fn node_status(
        tenant_id: impl Into<String>,
        session_id: impl Into<String>,
        request_id: impl Into<String>,
        plan_id: impl Into<String>,
        node_id: impl Into<String>,
        kind: PlanEventKind,
        status: impl Into<String>,
        title: impl Into<String>,
    ) -> Self {
        let node_id = node_id.into();
        let mut event = Self::new(
            tenant_id,
            session_id,
            request_id,
            plan_id,
            kind,
            json!({
                "nodeId": node_id,
                "status": status.into(),
                "title": title.into(),
            }),
        );
        event.node_id = Some(node_id);
        event
    }

    pub fn memory_patch_proposed(
        tenant_id: impl Into<String>,
        session_id: impl Into<String>,
        request_id: impl Into<String>,
        plan_id: impl Into<String>,
        proposal_id: impl Into<String>,
        operation: impl Into<String>,
        after_json: Value,
    ) -> Self {
        let proposal_id = proposal_id.into();
        Self::new(
            tenant_id,
            session_id,
            request_id,
            plan_id,
            PlanEventKind::MemoryPatchProposed,
            json!({
                "proposalId": proposal_id,
                "targetKind": "memory",
                "operation": operation.into(),
                "afterJson": after_json,
                "status": "proposed",
            }),
        )
    }

    pub fn knowledge_patch_proposed(
        tenant_id: impl Into<String>,
        session_id: impl Into<String>,
        request_id: impl Into<String>,
        plan_id: impl Into<String>,
        proposal_id: impl Into<String>,
        operation: impl Into<String>,
        target_ref: Option<String>,
        after_json: Value,
    ) -> Self {
        let proposal_id = proposal_id.into();
        Self::new(
            tenant_id,
            session_id,
            request_id,
            plan_id,
            PlanEventKind::KnowledgePatchProposed,
            json!({
                "proposalId": proposal_id,
                "targetKind": "knowledge",
                "operation": operation.into(),
                "targetRef": target_ref,
                "afterJson": after_json,
                "status": "proposed",
            }),
        )
    }

    pub fn to_pending_stream_event(&self) -> PendingStreamEvent {
        PendingStreamEvent {
            event_type: self.kind.as_str().to_string(),
            payload: self.payload.clone(),
            event_id: Some(self.event_id.clone()),
            sequence_num: self.sequence_num,
            request_id: self.request_id.clone(),
            session_id: self.session_id.clone(),
        }
    }
}

#[cfg(test)]
#[path = "../tests/plan/event_tests.rs"]
mod tests;
