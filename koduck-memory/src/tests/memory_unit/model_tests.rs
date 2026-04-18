use super::*;

#[test]
fn memory_kind_null_maps_to_generic() {
    assert_eq!(
        MemoryUnitKind::from_db_value(None).unwrap(),
        MemoryUnitKind::GenericConversation
    );
    assert_eq!(MemoryUnitKind::GenericConversation.as_db_value(), None);
}

#[test]
fn ready_summary_requires_payload() {
    let error = MemoryUnitSummaryState::ready("   ").unwrap_err();
    assert!(error.to_string().contains("non-empty summary"));
}

#[test]
fn pending_summary_rejects_payload_on_read() {
    let state = MemoryUnitSummaryState {
        summary_status: "pending".to_string(),
        summary: Some("unexpected".to_string()),
    };

    assert!(state.payload().is_err());
}
