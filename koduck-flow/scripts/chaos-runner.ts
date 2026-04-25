import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";

interface ChaosScenarioResult {
  name: string;
  description: string;
  status: "pass" | "warn" | "fail";
  metrics: Record<string, number>;
  notes: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

interface ChaosReport {
  generatedAt: string;
  totalDurationMs: number;
  scenarios: ChaosScenarioResult[];
}

const CHAOS_DOCS_DIR = path.resolve("./docs/chaos");
const REPORT_JSON = path.join(CHAOS_DOCS_DIR, "latest-report.json");
const REPORT_MARKDOWN = path.join(CHAOS_DOCS_DIR, "latest-report.md");

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function runLatencyScenario(): Promise<ChaosScenarioResult> {
  const startedAt = new Date();
  const iterations = Number(process.env.CHAOS_LATENCY_ITERATIONS ?? 20);
  const maxLatency = Number(process.env.CHAOS_LATENCY_MAX ?? 120);
  const latencies: number[] = [];
  const phaseStart = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    const jitter = randomBetween(10, maxLatency);
    const opStart = performance.now();
    await delay(jitter);
    const elapsed = performance.now() - opStart;
    latencies.push(elapsed);
  }

  const durationMs = performance.now() - phaseStart;
  const average = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const p95Index = Math.min(
    sortedLatencies.length - 1,
    Math.max(0, Math.floor(sortedLatencies.length * 0.95) - 1)
  );
  const p95 = sortedLatencies[p95Index] ?? 0;
  const max = Math.max(...latencies);
  const status: ChaosScenarioResult["status"] = max > 1.5 * maxLatency ? "warn" : "pass";

  return {
    name: "latency-injection",
    description: "Inject randomized latency to assess jitter tolerance.",
    status,
    metrics: {
      iterations,
      averageLatencyMs: Number(average.toFixed(2)),
      p95LatencyMs: Number(p95.toFixed(2)),
      maxLatencyMs: Number(max.toFixed(2)),
      targetLatencyMs: maxLatency,
    },
    notes: [
      status === "warn"
        ? "Observed latency above configured budget; consider widening frame slack."
        : "Latency stayed within configured jitter budget.",
    ],
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Number(durationMs.toFixed(2)),
  };
}

async function runErrorScenario(): Promise<ChaosScenarioResult> {
  const startedAt = new Date();
  const attempts = Number(process.env.CHAOS_ERROR_ATTEMPTS ?? 50);
  const failureRate = Number(process.env.CHAOS_ERROR_RATE ?? 0.35);
  const errors: Error[] = [];
  const successes: number[] = [];
  const phaseStart = performance.now();

  for (let index = 0; index < attempts; index += 1) {
    const shouldFail = Math.random() < failureRate;
    try {
      if (shouldFail) {
        throw new Error(`Injected failure #${index + 1}`);
      }
      const syntheticWork = Math.sin(index) + Math.cos(index / 2);
      successes.push(syntheticWork);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error);
      } else {
        errors.push(new Error(String(error)));
      }
    }
  }

  const durationMs = performance.now() - phaseStart;
  const errorRateObserved = errors.length / attempts;
  const status: ChaosScenarioResult["status"] =
    errorRateObserved > failureRate * 1.2 ? "fail" : "pass";

  return {
    name: "fault-injection",
    description: "Randomly throw errors to validate resilience and telemetry.",
    status,
    metrics: {
      attempts,
      configuredFailureRate: failureRate,
      observedFailureRate: Number(errorRateObserved.toFixed(2)),
      successCount: successes.length,
      errorCount: errors.length,
    },
    notes: [
      `Captured ${errors.length} injected failures`,
      status === "fail"
        ? "Observed failure rate exceeded tolerated threshold. Investigate error handling paths."
        : "Injected failures stayed within the expected envelope.",
    ],
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Number(durationMs.toFixed(2)),
  };
}

async function runResourceScenario(): Promise<ChaosScenarioResult> {
  const startedAt = new Date();
  const tasks = Number(process.env.CHAOS_RESOURCE_TASKS ?? 30);
  const maxConcurrency = Number(process.env.CHAOS_RESOURCE_CONCURRENCY ?? 3);
  const simulatedMemoryBudget = Number(process.env.CHAOS_RESOURCE_BUDGET ?? 100);

  type ResourceSample = { memoryUsed: number; duration: number };
  const samples: ResourceSample[] = [];
  let currentConcurrency = 0;
  let peakConcurrency = 0;
  let peakMemoryUsage = 0;
  let currentMemoryUsage = 0;
  let throttled = 0;
  let memoryExceeded = false;

  const phaseStart = performance.now();

  const runTask = async (id: number) => {
    while (currentConcurrency >= maxConcurrency) {
      throttled += 1;
      await delay(5);
    }

    currentConcurrency += 1;
    peakConcurrency = Math.max(peakConcurrency, currentConcurrency);

    const memoryDemand = randomBetween(1, 10) * (1 + id * 0.01);
    const requestedMemory = currentMemoryUsage + memoryDemand;
    if (requestedMemory > simulatedMemoryBudget) {
      memoryExceeded = true;
    }
    currentMemoryUsage = Math.min(simulatedMemoryBudget, requestedMemory);
    peakMemoryUsage = Math.max(peakMemoryUsage, currentMemoryUsage);

    const duration = randomBetween(5, 25);
    await delay(duration);

    samples.push({ memoryUsed: currentMemoryUsage, duration });
    currentMemoryUsage = Math.max(0, currentMemoryUsage - memoryDemand);
    currentConcurrency -= 1;
  };

  const pool: Promise<void>[] = [];
  for (let index = 0; index < tasks; index += 1) {
    const taskPromise = runTask(index).finally(() => {
      const idx = pool.indexOf(taskPromise);
      if (idx >= 0) {
        pool.splice(idx, 1);
      }
    });
    pool.push(taskPromise);
    if (pool.length >= maxConcurrency) {
      await Promise.race(pool).catch(() => undefined);
    }
  }

  await Promise.allSettled(pool);

  const durationMs = performance.now() - phaseStart;
  const averageDuration =
    samples.reduce((sum, sample) => sum + sample.duration, 0) / Math.max(samples.length, 1);
  const status: ChaosScenarioResult["status"] =
    memoryExceeded || throttled > tasks * 0.4 ? "warn" : "pass";

  return {
    name: "resource-throttle",
    description: "Simulate resource pressure via constrained concurrency and memory budget.",
    status,
    metrics: {
      tasks,
      maxConcurrency,
      observedPeakConcurrency: peakConcurrency,
      simulatedMemoryBudget,
      observedPeakMemory: Number(peakMemoryUsage.toFixed(2)),
      throttledCount: throttled,
      memoryExceeded: memoryExceeded ? 1 : 0,
      averageTaskDurationMs: Number(averageDuration.toFixed(2)),
    },
    notes: [
      throttled > 0
        ? `Throttled ${throttled} tasks due to artificial capacity limits.`
        : "No throttling observed under current limits.",
    ],
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: Number(durationMs.toFixed(2)),
  };
}

async function writeReport(report: ChaosReport): Promise<void> {
  await mkdir(CHAOS_DOCS_DIR, { recursive: true });
  await writeFile(REPORT_JSON, JSON.stringify(report, null, 2), "utf-8");

  const markdownLines: string[] = [];
  markdownLines.push("# Chaos test report");
  markdownLines.push("");
  markdownLines.push(`Generated at: ${report.generatedAt}`);
  markdownLines.push(`Total duration: ${report.totalDurationMs.toFixed(2)} ms`);
  markdownLines.push("");
  markdownLines.push("| Scenario | Status | Duration (ms) | Key metrics | Notes |");
  markdownLines.push("| --- | --- | ---: | --- | --- |");

  for (const scenario of report.scenarios) {
    const metricsSummary = Object.entries(scenario.metrics)
      .map(([key, value]) => `${key}=${value}`)
      .join("<br />");
    const notes = scenario.notes.join("<br />");
    markdownLines.push(
      `| ${scenario.name} | ${scenario.status} | ${scenario.durationMs.toFixed(2)} | ${metricsSummary} | ${notes} |`
    );
  }

  markdownLines.push("");

  await writeFile(REPORT_MARKDOWN, markdownLines.join("\n"), "utf-8");
}

async function main(): Promise<void> {
  const startedAt = performance.now();
  const scenarios: Array<() => Promise<ChaosScenarioResult>> = [
    runLatencyScenario,
    runErrorScenario,
    runResourceScenario,
  ];

  const results: ChaosScenarioResult[] = [];
  for (const run of scenarios) {
    const result = await run();
    results.push(result);
    const { name, status } = result;
    const statusEmoji = status === "pass" ? "✅" : status === "warn" ? "⚠️" : "❌";
    console.log(`${statusEmoji} ${name} => ${status}`);
  }

  const report: ChaosReport = {
    generatedAt: new Date().toISOString(),
    totalDurationMs: performance.now() - startedAt,
    scenarios: results,
  };

  await writeReport(report);

  const failed = results.some((scenario) => scenario.status === "fail");
  const warned = results.some((scenario) => scenario.status === "warn");

  if (failed) {
    console.error(
      "❌ Chaos testing detected failing scenarios. See docs/chaos/latest-report.* for details."
    );
    process.exitCode = 1;
  } else if (warned) {
    console.warn(
      "⚠️ Chaos testing completed with warnings. Review docs/chaos/latest-report.* for mitigation guidance."
    );
  } else {
    console.log("✅ Chaos testing completed without warnings.");
  }
}

void main().catch((error) => {
  console.error("🚨 Chaos test runner crashed", error);
  process.exitCode = 1;
});
