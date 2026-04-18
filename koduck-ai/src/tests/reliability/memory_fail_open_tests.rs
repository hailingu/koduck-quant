use super::{MemoryFailOpenOperation, MemoryFailOpenTracker};

#[test]
fn snapshot_starts_at_zero() {
    let tracker = MemoryFailOpenTracker::new();
    let snapshot = tracker.snapshot();

    assert_eq!(snapshot.get_session_errors, 0);
    assert_eq!(snapshot.upsert_session_meta_errors, 0);
    assert_eq!(snapshot.query_memory_errors, 0);
    assert_eq!(snapshot.append_memory_errors, 0);
}

#[test]
fn record_and_snapshot() {
    let tracker = MemoryFailOpenTracker::new();

    tracker.record(MemoryFailOpenOperation::GetSession);
    tracker.record(MemoryFailOpenOperation::GetSession);
    tracker.record(MemoryFailOpenOperation::UpsertSessionMeta);
    tracker.record(MemoryFailOpenOperation::QueryMemory);
    tracker.record(MemoryFailOpenOperation::QueryMemory);
    tracker.record(MemoryFailOpenOperation::QueryMemory);
    tracker.record(MemoryFailOpenOperation::AppendMemory);

    let snapshot = tracker.snapshot();
    assert_eq!(snapshot.get_session_errors, 2);
    assert_eq!(snapshot.upsert_session_meta_errors, 1);
    assert_eq!(snapshot.query_memory_errors, 3);
    assert_eq!(snapshot.append_memory_errors, 1);
}
