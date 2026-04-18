use super::*;
use std::time::Duration;

#[test]
fn histogram_records_into_correct_bucket() {
    let mut hist = RpcHistogram::new();
    hist.record(0);
    hist.record(3);
    hist.record(7);
    hist.record(30);
    hist.record(2000);

    assert_eq!(hist.buckets[0], 1);
    assert_eq!(hist.buckets[1], 1);
    assert_eq!(hist.buckets[2], 1);
    assert_eq!(hist.buckets[3], 1);
    assert_eq!(hist.buckets[4], 1);
    assert_eq!(hist.buckets[8], 0);
    assert_eq!(hist.buckets[9], 1);
    assert_eq!(hist.count, 5);
    assert_eq!(hist.sum, 2040);
}

#[test]
fn rpc_metrics_record_and_render() {
    let metrics = RpcMetrics::new();
    let start = Instant::now() - Duration::from_millis(5);

    metrics.record("get_session", "ok", start);
    metrics.record("get_session", "ok", start);
    metrics.record("get_session", "error", start);

    let output = metrics.render();
    assert!(output.contains("koduck_memory_rpc_requests_total{rpc=\"get_session\",status=\"ok\"} 2"));
    assert!(output.contains("koduck_memory_rpc_requests_total{rpc=\"get_session\",status=\"error\"} 1"));
    assert!(output.contains("koduck_memory_rpc_duration_ms_bucket{rpc=\"get_session\",le=\"5\"} 3"));
    assert!(output.contains("koduck_memory_rpc_duration_ms_count{rpc=\"get_session\"} 3"));
}

#[test]
fn rpc_guard_records_ok_by_default() {
    let metrics = RpcMetrics::new();
    {
        let _guard = RpcGuard::new(&metrics, "query_memory");
    }
    let output = metrics.render();
    assert!(output.contains("status=\"ok\""));
    assert!(!output.contains("status=\"error\""));
}

#[test]
fn rpc_guard_records_error_when_explicit() {
    let metrics = RpcMetrics::new();
    {
        let mut guard = RpcGuard::new(&metrics, "append_memory");
        guard.error();
    }
    let output = metrics.render();
    assert!(output.contains("status=\"error\""));
}
