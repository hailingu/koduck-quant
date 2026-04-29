import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  WorkerPoolRuntime,
  WORKER_POOL_WORKER_CRASH_CODE,
  type TaskFallbackExecutor,
} from "../../../src/common/worker-pool";
import { WorkerPoolMetricsAdapter } from "../../../src/common/worker-pool/metrics";
import { InMemoryMetricsProvider } from "../../../src/common/metrics/in-memory";
import { NoopMetricsProvider } from "../../../src/common/metrics/noop";
import { setMetricsProvider } from "../../../src/common/metrics";
import type { ProviderSnapshot } from "../../../src/common/metrics";
import { WorkerPoolError } from "../../../src/common/worker-pool/types";

function sumMetricPoints(data?: { points: Record<string, { value: number }> }): number {
  if (!data) return 0;
  let total = 0;
  for (const point of Object.values(data.points)) {
    total += point.value;
  }
  return total;
}

function getMeterSnapshot(snapshot: ProviderSnapshot, scope: string) {
  return snapshot.meters.find((meter) => meter.scope === scope);
}

describe("WorkerPoolMetricsAdapter", () => {
  let provider: InMemoryMetricsProvider;

  beforeEach(() => {
    provider = new InMemoryMetricsProvider();
    setMetricsProvider(provider);
  });

  afterEach(() => {
    setMetricsProvider(new NoopMetricsProvider());
  });

  it("records task completion and queue metrics", async () => {
    const pool = new WorkerPoolRuntime({ workerCount: 2, retryDelay: 0 });
    const adapter = new WorkerPoolMetricsAdapter(pool, { poolId: "metrics-test" });

    pool.registerHandler("increment", (payload: { value: number }) => payload.value + 1);

    const tasks = Array.from({ length: 8 }, (_, index) =>
      pool.execute({ type: "increment", payload: { value: index } })
    );

    await Promise.all(tasks);

    provider.collect();
    const snapshot = provider.snapshot();
    const meterSnapshot = getMeterSnapshot(snapshot, "worker-pool");
    expect(meterSnapshot).toBeDefined();

    const completedCounter = meterSnapshot?.counters.find(
      (counter) => counter.name === "pool.task.completed.count"
    );
    expect(sumMetricPoints(completedCounter)).toBe(8);

    const queueGauge = meterSnapshot?.gauges.find((gauge) => gauge.name === "pool.queue.size");
    expect(sumMetricPoints(queueGauge)).toBe(0);

    const completedGauge = meterSnapshot?.gauges.find(
      (gauge) => gauge.name === "pool.tasks.completed_total"
    );
    expect(sumMetricPoints(completedGauge)).toBe(8);

    adapter.dispose();
    pool.dispose();
  });

  it("reports recovery and crash counts after worker crash", async () => {
    const pool = new WorkerPoolRuntime({ workerCount: 1, retryDelay: 0, workerRecoveryDelay: 1 });
    const adapter = new WorkerPoolMetricsAdapter(pool, { poolId: "recovery-test" });

    let attempts = 0;
    pool.registerHandler("flaky", () => {
      attempts += 1;
      if (attempts === 1) {
        throw new WorkerPoolError("crash", WORKER_POOL_WORKER_CRASH_CODE);
      }
      return "ok";
    });

    const result = await pool.execute({ type: "flaky", payload: null });
    expect(result).toBe("ok");

    // Wait for recovery timer to execute
    await new Promise((resolve) => setTimeout(resolve, 5));

    provider.collect();
    const snapshot = provider.snapshot();
    const meterSnapshot = getMeterSnapshot(snapshot, "worker-pool");
    expect(meterSnapshot).toBeDefined();

    const crashCounter = meterSnapshot?.counters.find(
      (counter) => counter.name === "pool.worker.crash.count"
    );
    expect(sumMetricPoints(crashCounter)).toBe(1);

    const recoveryCounter = meterSnapshot?.counters.find(
      (counter) => counter.name === "pool.worker.recovered.count"
    );
    expect(sumMetricPoints(recoveryCounter)).toBe(1);

    adapter.dispose();
    pool.dispose();
  });

  it("records fallback count during fallback execution", async () => {
    const pool = new WorkerPoolRuntime({
      workerCount: 1,
      retryDelay: 0,
      maxRetries: 1,
      workerRecoveryDelay: 1,
      fallbackExecutor: (() => null) as TaskFallbackExecutor,
    });
    const adapter = new WorkerPoolMetricsAdapter(pool, { poolId: "fallback-test" });

    pool.registerHandler("always-crash", () => {
      throw new WorkerPoolError("fail", WORKER_POOL_WORKER_CRASH_CODE);
    });

    const result = await pool.execute({ type: "always-crash", payload: null });
    expect(result).toBeNull();

    provider.collect();
    const snapshot = provider.snapshot();
    const meterSnapshot = getMeterSnapshot(snapshot, "worker-pool");
    expect(meterSnapshot).toBeDefined();

    const fallbackCounter = meterSnapshot?.counters.find(
      (counter) => counter.name === "pool.task.fallback.count"
    );
    expect(sumMetricPoints(fallbackCounter)).toBe(1);

    adapter.dispose();
    pool.dispose();
  });
});
