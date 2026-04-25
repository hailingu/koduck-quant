import { describe, expect, it } from "vitest";

import {
  createTrendEntriesFromReport,
  createTrendEntry,
  generateMonthlyDigest,
  PerformanceTrend,
  updatePerformanceTrend,
} from "../../../src/common/monitoring/performance-trend";

describe("performance trend utilities", () => {
  it("derives entries from benchmark report", () => {
    const report = {
      generatedAt: "2025-10-13T00:00:00.000Z",
      results: [
        {
          scenario: "worker-pool",
          totalDurationMs: 1000,
          samples: [
            { label: "pool", throughput: 2000, durationMs: 250 },
            { label: "baseline", throughput: 1000, durationMs: 500 },
          ],
          details: { throughputGain: 2.0 },
        },
      ],
    };

    const [entry] = createTrendEntriesFromReport(report);
    expect(entry.scenario).toBe("worker-pool");
    expect(entry.metrics.avgThroughput).toBeGreaterThan(0);
    expect(entry.metrics["pool:throughput"]).toBeCloseTo(2000);
    expect(entry.metrics["detail:throughputGain"]).toBeCloseTo(2);
  });

  it("detects regressions above threshold", () => {
    const baseline = createTrendEntry({
      scenario: "worker-pool",
      totalDurationMs: 100,
      samples: [{ label: "pool", throughput: 2000, durationMs: 10 }],
    });

    const degraded = createTrendEntry(
      {
        scenario: "worker-pool",
        totalDurationMs: 130,
        samples: [{ label: "pool", throughput: 1500, durationMs: 15 }],
      },
      "2025-10-13T00:00:00.000Z"
    );

    let trend: PerformanceTrend | undefined;
    trend = updatePerformanceTrend(trend, baseline, { regressionThresholdPercent: 0.05 });
    trend = updatePerformanceTrend(trend, degraded, { regressionThresholdPercent: 0.05 });

    const metrics = trend.alerts.map((alert) => alert.metric);
    expect(metrics).toContain("pool:throughput");
    expect(metrics).toContain("totalDurationMs");
    const throughputAlert = trend.alerts.find((alert) => alert.metric === "pool:throughput");
    expect(throughputAlert?.severity).toBe("critical");
    const durationAlert = trend.alerts.find((alert) => alert.metric === "totalDurationMs");
    expect(durationAlert?.severity).toBe("critical");
  });

  it("renders digest with latest metrics and alerts", () => {
    const first = createTrendEntry(
      {
        scenario: "render",
        totalDurationMs: 80,
        samples: [{ label: "pass", throughput: 400, durationMs: 20 }],
      },
      "2025-10-12T00:00:00.000Z"
    );
    const second = createTrendEntry(
      {
        scenario: "render",
        totalDurationMs: 120,
        samples: [{ label: "pass", throughput: 200, durationMs: 30 }],
      },
      "2025-10-13T00:00:00.000Z"
    );

    let trend: PerformanceTrend | undefined;
    trend = updatePerformanceTrend(trend, first, { regressionThresholdPercent: 0.05 });
    trend = updatePerformanceTrend(trend, second, { regressionThresholdPercent: 0.05 });

    const digest = generateMonthlyDigest(trend, { maxAlerts: 5 });
    expect(digest).toContain("Performance Digest");
    expect(digest).toContain("render");
    expect(digest).toContain("Regressions");
  });
});
