use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// Histogram buckets for RPC latency (milliseconds).
const BUCKET_BOUNDS: &[u64] = &[1, 5, 10, 25, 50, 100, 250, 500, 1000];

/// Per-RPC histogram state.
#[derive(Default)]
struct RpcHistogram {
    buckets: Vec<u64>,
    count: u64,
    sum: u64,
}

impl RpcHistogram {
    fn new() -> Self {
        Self {
            buckets: vec![0; BUCKET_BOUNDS.len() + 1], // +1 for +Inf
            count: 0,
            sum: 0,
        }
    }

    fn record(&mut self, duration_ms: u64) {
        self.count += 1;
        self.sum += duration_ms;
        for (i, &bound) in BUCKET_BOUNDS.iter().enumerate() {
            if duration_ms <= bound {
                self.buckets[i] += 1;
                return;
            }
        }
        // Falls into +Inf bucket
        self.buckets[BUCKET_BOUNDS.len()] += 1;
    }
}

/// Per-RPC request counter keyed by (rpc, status).
#[derive(Default)]
struct RpcCounter {
    ok: u64,
    error: u64,
}

/// Global RPC metrics registry.
///
/// Thread-safe via `Mutex`. For V1 the contention overhead is acceptable
/// given the request volume through koduck-memory.
pub struct RpcMetrics {
    histograms: Mutex<HashMap<String, RpcHistogram>>,
    counters: Mutex<HashMap<String, RpcCounter>>,
}

impl RpcMetrics {
    pub fn new() -> Self {
        Self {
            histograms: Mutex::new(HashMap::new()),
            counters: Mutex::new(HashMap::new()),
        }
    }

    /// Record a completed RPC call.
    ///
    /// `rpc` is the method name (e.g. "get_session", "query_memory").
    /// `status` is "ok" or "error".
    /// `start` is the `Instant` captured at the beginning of the RPC handler.
    pub fn record(&self, rpc: &str, status: &str, start: Instant) {
        let duration_ms = start.elapsed().as_millis() as u64;

        // Record histogram
        if let Ok(mut hist) = self.histograms.lock() {
            hist.entry(rpc.to_string())
                .or_insert_with(RpcHistogram::new)
                .record(duration_ms);
        }

        // Record counter
        if let Ok(mut ctr) = self.counters.lock() {
            let entry = ctr.entry(rpc.to_string()).or_default();
            if status == "ok" {
                entry.ok += 1;
            } else {
                entry.error += 1;
            }
        }
    }

    /// Render all RPC metrics in Prometheus text format.
    pub fn render(&self) -> String {
        let mut output = String::new();

        // Render counters
        if let Ok(counters) = self.counters.lock() {
            output.push_str("# HELP koduck_memory_rpc_requests_total Total number of RPC requests.\n");
            output.push_str("# TYPE koduck_memory_rpc_requests_total counter\n");
            for (rpc, counter) in counters.iter() {
                if counter.ok > 0 {
                    output.push_str(&format!(
                        "koduck_memory_rpc_requests_total{{rpc=\"{}\",status=\"ok\"}} {}\n",
                        rpc, counter.ok
                    ));
                }
                if counter.error > 0 {
                    output.push_str(&format!(
                        "koduck_memory_rpc_requests_total{{rpc=\"{}\",status=\"error\"}} {}\n",
                        rpc, counter.error
                    ));
                }
            }
        }

        // Render histograms
        if let Ok(histograms) = self.histograms.lock() {
            output.push_str("# HELP koduck_memory_rpc_duration_ms RPC duration in milliseconds.\n");
            output.push_str("# TYPE koduck_memory_rpc_duration_ms histogram\n");
            for (rpc, hist) in histograms.iter() {
                // Cumulative bucket counts
                let mut cumulative = 0u64;
                for (i, &bound) in BUCKET_BOUNDS.iter().enumerate() {
                    cumulative += hist.buckets[i];
                    output.push_str(&format!(
                        "koduck_memory_rpc_duration_ms_bucket{{rpc=\"{}\",le=\"{}\"}} {}\n",
                        rpc, bound, cumulative
                    ));
                }
                // +Inf bucket
                cumulative += hist.buckets[BUCKET_BOUNDS.len()];
                output.push_str(&format!(
                    "koduck_memory_rpc_duration_ms_bucket{{rpc=\"{}\",le=\"+Inf\"}} {}\n",
                    rpc, cumulative
                ));
                output.push_str(&format!(
                    "koduck_memory_rpc_duration_ms_sum{{rpc=\"{}\"}} {}\n",
                    rpc, hist.sum
                ));
                output.push_str(&format!(
                    "koduck_memory_rpc_duration_ms_count{{rpc=\"{}\"}} {}\n",
                    rpc, hist.count
                ));
            }
        }

        output
    }
}

/// A guard that records RPC metrics on drop.
///
/// Usage:
/// ```ignore
/// let _guard = RpcGuard::new(&metrics, "get_session", start);
/// // ... handle RPC ...
/// // on drop, records "ok" status
/// ```
///
/// If the RPC returns an error, call `guard.error()` before dropping.
pub struct RpcGuard<'a> {
    metrics: &'a RpcMetrics,
    rpc: &'static str,
    start: Instant,
    status: &'static str,
}

impl<'a> RpcGuard<'a> {
    pub fn new(metrics: &'a RpcMetrics, rpc: &'static str) -> Self {
        Self {
            metrics,
            rpc,
            start: Instant::now(),
            status: "ok",
        }
    }

    /// Mark this RPC as errored before dropping.
    pub fn error(&mut self) {
        self.status = "error";
    }

    /// Return elapsed milliseconds since the guard was created.
    pub fn elapsed_ms(&self) -> u64 {
        self.start.elapsed().as_millis() as u64
    }
}

impl Drop for RpcGuard<'_> {
    fn drop(&mut self) {
        self.metrics.record(self.rpc, self.status, self.start);
    }
}

#[cfg(test)]
#[path = "../tests/observe/rpc_metrics_tests.rs"]
mod tests;
