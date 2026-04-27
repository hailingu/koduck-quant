use serde_json::json;
use uuid::Uuid;

use crate::plan::{
    CreateEditProposal, CreatePlan, InsertPlanArtifact, InsertPlanEvent,
    ReviewEditProposal, SavePlanSnapshot,
};
use crate::plan::proposal::{validate_review_transition, EditProposalStatus};

#[test]
fn create_plan_defaults_to_draft() {
    let session_id = Uuid::new_v4();
    let plan = CreatePlan::new(
        "tenant-1",
        session_id,
        "req-1",
        "分析北向资金并生成建议",
        Some("user-1".to_string()),
    );

    assert_eq!(plan.tenant_id, "tenant-1");
    assert_eq!(plan.session_id, session_id);
    assert_eq!(plan.request_id, "req-1");
    assert_eq!(plan.status, "draft");
    assert_eq!(plan.created_by.as_deref(), Some("user-1"));
}

#[test]
fn insert_plan_event_carries_sequence_and_payload() {
    let session_id = Uuid::new_v4();
    let plan_id = Uuid::new_v4();
    let event = InsertPlanEvent::new(
        "tenant-1",
        session_id,
        plan_id,
        2,
        "plan.node.completed",
        json!({"nodeId": "fetch_market_data"}),
    );

    assert_eq!(event.sequence_num, 2);
    assert_eq!(event.event_type, "plan.node.completed");
    assert_eq!(event.payload_json["nodeId"], "fetch_market_data");
}

#[test]
fn snapshot_and_artifact_builders_assign_ids() {
    let session_id = Uuid::new_v4();
    let plan_id = Uuid::new_v4();
    let snapshot = SavePlanSnapshot::new(
        "tenant-1",
        session_id,
        plan_id,
        3,
        json!({"status": "running"}),
    );
    let artifact = InsertPlanArtifact::new("tenant-1", session_id, plan_id, "tool_result");

    assert_ne!(snapshot.snapshot_id, Uuid::nil());
    assert_eq!(snapshot.version, 3);
    assert_ne!(artifact.artifact_id, Uuid::nil());
    assert_eq!(artifact.artifact_type, "tool_result");
}

#[test]
fn proposal_defaults_to_proposed_review_approval_helper() {
    let session_id = Uuid::new_v4();
    let plan_id = Uuid::new_v4();
    let proposal = CreateEditProposal::new(
        "tenant-1",
        session_id,
        plan_id,
        "memory",
        "append",
        json!({"fact": "用户偏好中文回答"}),
    );
    let review = ReviewEditProposal::approve(
        "tenant-1",
        session_id,
        proposal.proposal_id,
        "user-1",
    );

    assert_eq!(proposal.target_kind, "memory");
    assert_eq!(proposal.operation, "append");
    assert_eq!(proposal.after_json["fact"], "用户偏好中文回答");
    assert_eq!(review.status, "approved");
    assert_eq!(review.reviewed_by, "user-1");
}

#[test]
fn proposal_review_helpers_cover_reject_edit_and_apply() {
    let session_id = Uuid::new_v4();
    let proposal_id = Uuid::new_v4();
    let reject = ReviewEditProposal::reject("tenant-1", session_id, proposal_id, "user-1");
    let edit = ReviewEditProposal::edit(
        "tenant-1",
        session_id,
        proposal_id,
        "user-1",
        json!({"fact": "用户偏好中文和简洁说明"}),
    );
    let edit_and_approve = ReviewEditProposal::edit_and_approve(
        "tenant-1",
        session_id,
        proposal_id,
        "user-1",
        json!({"fact": "用户偏好中文和简洁说明"}),
    );
    let apply = ReviewEditProposal::apply("tenant-1", session_id, proposal_id, "system");

    assert_eq!(reject.status, "rejected");
    assert_eq!(edit.status, "edited");
    assert!(edit.after_json.is_some());
    assert_eq!(edit_and_approve.status, "approved");
    assert!(edit_and_approve.after_json.is_some());
    assert_eq!(apply.status, "applied");
    assert!(apply.applied);
}

#[test]
fn proposal_status_transition_rules_prevent_terminal_replay() {
    assert!(validate_review_transition(
        EditProposalStatus::Proposed,
        EditProposalStatus::Approved,
        false,
    )
    .is_ok());
    assert!(validate_review_transition(
        EditProposalStatus::Edited,
        EditProposalStatus::Applied,
        false,
    )
    .is_ok());
    assert!(validate_review_transition(
        EditProposalStatus::Rejected,
        EditProposalStatus::Approved,
        false,
    )
    .is_err());
    assert!(validate_review_transition(
        EditProposalStatus::Proposed,
        EditProposalStatus::Edited,
        false,
    )
    .is_err());
}
