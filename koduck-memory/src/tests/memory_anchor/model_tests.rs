use super::*;

#[test]
fn anchor_type_round_trip_works() {
    let kind = MemoryUnitAnchorType::from_db_value("discourse_action").unwrap();
    assert_eq!(kind, MemoryUnitAnchorType::DiscourseAction);
    assert_eq!(kind.as_db_value(), "discourse_action");
}

#[test]
fn anchor_builder_rejects_blank_key() {
    let result = InsertMemoryUnitAnchor::new(
        "tenant",
        Uuid::new_v4(),
        MemoryUnitAnchorType::Domain,
        "   ",
    );
    assert!(result.is_err());
}

#[test]
fn anchor_with_unknown_key_is_not_persistable() {
    let params = InsertMemoryUnitAnchor::new(
        "tenant",
        Uuid::new_v4(),
        MemoryUnitAnchorType::Domain,
        "unknown",
    )
    .unwrap();

    assert!(!params.should_persist());
}

#[test]
fn fact_type_anchor_without_value_is_not_persistable() {
    let params = InsertMemoryUnitAnchor::new(
        "tenant",
        Uuid::new_v4(),
        MemoryUnitAnchorType::FactType,
        "preference",
    )
    .unwrap();

    assert!(!params.should_persist());
}

#[test]
fn domain_anchor_without_value_remains_persistable() {
    let params = InsertMemoryUnitAnchor::new(
        "tenant",
        Uuid::new_v4(),
        MemoryUnitAnchorType::Domain,
        "task",
    )
    .unwrap();

    assert!(params.should_persist());
}
