use crate::plan::{PlanEvent, PlanEventKind};
use serde_json::json;

#[test]
fn plan_event_converts_to_pending_stream_event() {
    let event = PlanEvent::node_status(
        "tenant-1",
        "session-1",
        "req-1",
        "plan-1",
        "node-1",
        PlanEventKind::PlanNodeCompleted,
        "completed",
        "完成节点",
    );

    let pending = event.to_pending_stream_event();

    assert_eq!(pending.event_type, "plan.node.completed");
    assert_eq!(pending.request_id, "req-1");
    assert_eq!(pending.session_id, "session-1");
    assert_eq!(pending.payload["nodeId"], "node-1");
    assert_eq!(pending.payload["status"], "completed");
}

#[test]
fn memory_patch_proposed_event_is_confirmation_first() {
    let event = PlanEvent::memory_patch_proposed(
        "tenant-1",
        "session-1",
        "req-1",
        "plan-1",
        "proposal-1",
        "append",
        json!({"fact": "用户偏好中文回答"}),
    );

    let pending = event.to_pending_stream_event();

    assert_eq!(pending.event_type, "memory.patch.proposed");
    assert_eq!(pending.payload["proposalId"], "proposal-1");
    assert_eq!(pending.payload["targetKind"], "memory");
    assert_eq!(pending.payload["status"], "proposed");
    assert_eq!(pending.payload["afterJson"]["fact"], "用户偏好中文回答");
}

#[test]
fn knowledge_patch_proposed_event_is_not_applied() {
    let event = PlanEvent::knowledge_patch_proposed(
        "tenant-1",
        "session-1",
        "req-1",
        "plan-1",
        "proposal-1",
        "merge",
        Some("entity:wilhelm-ii".to_string()),
        json!({"summary": "候选知识更新"}),
    );

    let pending = event.to_pending_stream_event();

    assert_eq!(pending.event_type, "knowledge.patch.proposed");
    assert_eq!(pending.payload["targetKind"], "knowledge");
    assert_eq!(pending.payload["targetRef"], "entity:wilhelm-ii");
    assert_eq!(pending.payload["status"], "proposed");
}
