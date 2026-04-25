import { describe, expect, it } from "vitest";

import {
  StabilityTrend,
  summariseStability,
  updateStabilityTrend,
} from "../../../src/common/monitoring/stability-metrics";

describe("stability monitoring utilities", () => {
  it("summarises stability report into trend entry", () => {
    const report = {
      summary: {
        totalRuns: 3,
        averageSuccessRate: 0.999,
        minSuccessRate: 0.998,
        maxSuccessRate: 1,
        averageDuration: 1000,
        stabilityScore: 95,
        flakyTests: ["test/a", "test/b"],
      },
      runs: [],
    };

    const entry = summariseStability(report as never);
    expect(entry.averageSuccessRate).toBeCloseTo(0.999);
    expect(entry.averageErrorRate).toBeGreaterThan(0);
    expect(entry.flakyTests).toBe(2);
  });

  it("emits alerts when thresholds are breached", () => {
    const report = {
      summary: {
        totalRuns: 5,
        averageSuccessRate: 0.95,
        minSuccessRate: 0.9,
        maxSuccessRate: 1,
        averageDuration: 1200,
        stabilityScore: 70,
        flakyTests: [],
      },
      runs: [],
    };

    const entry = summariseStability(report as never);
    const trend: StabilityTrend = updateStabilityTrend(undefined, entry, {
      errorThreshold: 0.001,
      stabilityScoreThreshold: 90,
    });

    expect(trend.alerts).toHaveLength(2);
    expect(trend.alerts[0]).toMatchObject({ metric: "errorRate" });
    expect(trend.alerts[1]).toMatchObject({ metric: "stabilityScore" });
  });
});
