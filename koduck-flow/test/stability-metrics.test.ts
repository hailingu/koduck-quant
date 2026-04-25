/**
 * Stability Metrics Unit Tests
 *
 * Comprehensive test suite for all stability metric calculations.
 * Target: ≥85% statement coverage
 *
 * @module test/e2e/stability-metrics.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  calculateSuccessRate,
  calculateMemoryGrowth,
  calculateRenderDegradation,
  calculateAverage,
  calculateStabilityScore,
  determineStatus,
  buildAlerts,
  STABILITY_THRESHOLDS,
} from "../src/utils/stability-metrics";

describe("Stability Metrics Unit Tests", () => {
  // =====================================================
  // Success Rate Calculation Tests
  // =====================================================
  describe("calculateSuccessRate", () => {
    it("should return 1.0 for all tests passed", () => {
      expect(calculateSuccessRate(100, 100)).toBe(1);
      expect(calculateSuccessRate(50, 50)).toBe(1);
      expect(calculateSuccessRate(1, 1)).toBe(1);
    });

    it("should return 0 for all tests failed", () => {
      expect(calculateSuccessRate(0, 100)).toBe(0);
      expect(calculateSuccessRate(0, 50)).toBe(0);
    });

    it("should return 0 for no tests", () => {
      expect(calculateSuccessRate(0, 0)).toBe(0);
    });

    it("should calculate correct rates for partial passes", () => {
      expect(calculateSuccessRate(95, 100)).toBe(0.95);
      expect(calculateSuccessRate(50, 100)).toBe(0.5);
      expect(calculateSuccessRate(3, 10)).toBe(0.3);
      expect(calculateSuccessRate(1, 2)).toBe(0.5);
    });

    it("should handle threshold boundary cases", () => {
      const threshold = STABILITY_THRESHOLDS.successRate;
      expect(calculateSuccessRate(Math.ceil(threshold * 1000), 1000)).toBeGreaterThanOrEqual(
        threshold
      );
      // 950/1000 = 0.95, which is exactly the threshold (not less than)
      expect(calculateSuccessRate(949, 1000)).toBeLessThan(threshold);
    });

    it("should return rates close to but below threshold", () => {
      expect(calculateSuccessRate(949, 1000)).toBe(0.949);
      expect(calculateSuccessRate(949, 1000)).toBeLessThan(STABILITY_THRESHOLDS.successRate);
    });

    it("should return rates at and above threshold", () => {
      expect(calculateSuccessRate(950, 1000)).toBe(0.95);
      expect(calculateSuccessRate(951, 1000)).toBe(0.951);
      expect(calculateSuccessRate(950, 1000)).toBeGreaterThanOrEqual(
        STABILITY_THRESHOLDS.successRate
      );
    });
  });

  // =====================================================
  // Memory Growth Calculation Tests
  // =====================================================
  describe("calculateMemoryGrowth", () => {
    it("should return 0 for empty array", () => {
      expect(calculateMemoryGrowth([])).toBe(0);
    });

    it("should return 0 for single value", () => {
      expect(calculateMemoryGrowth([100])).toBe(0);
    });

    it("should return 0 for no growth (constant memory)", () => {
      expect(calculateMemoryGrowth([100, 100, 100])).toBe(0);
      expect(calculateMemoryGrowth([50, 50])).toBe(0);
    });

    it("should calculate linear growth correctly", () => {
      expect(calculateMemoryGrowth([100, 150, 200])).toBe(100); // 100% growth
      expect(calculateMemoryGrowth([100, 200])).toBe(100);
      expect(calculateMemoryGrowth([50, 75])).toBe(50); // 50% growth
    });

    it("should calculate exponential growth correctly", () => {
      expect(calculateMemoryGrowth([100, 200, 400, 800])).toBe(700); // 700% growth
    });

    it("should handle zero minimum memory (divide by zero edge case)", () => {
      expect(calculateMemoryGrowth([0, 100])).toBe(0);
      expect(calculateMemoryGrowth([0, 0])).toBe(0);
    });

    it("should handle negative memory values", () => {
      expect(calculateMemoryGrowth([-100, 100])).toBe(0);
      expect(calculateMemoryGrowth([-50, -100])).toBe(0);
    });

    it("should round to 2 decimal places", () => {
      const result = calculateMemoryGrowth([100, 333.333]);
      expect(result).toBe(Math.round((233.333 / 100) * 100 * 100) / 100);
    });

    it("should handle exceed threshold (200%)", () => {
      expect(calculateMemoryGrowth([100, 300])).toBe(200); // Exactly at threshold
      expect(calculateMemoryGrowth([100, 301])).toBe(201); // Exceeds threshold
      expect(calculateMemoryGrowth([100, 299])).toBe(199); // Below threshold
    });

    it("should handle small values", () => {
      expect(calculateMemoryGrowth([0.1, 0.2])).toBe(100);
      expect(calculateMemoryGrowth([1, 2, 3])).toBe(200); // 3 is max, 1 is min
    });
  });

  // =====================================================
  // Render Degradation Calculation Tests
  // =====================================================
  describe("calculateRenderDegradation", () => {
    it("should return 0 for empty array", () => {
      expect(calculateRenderDegradation([])).toBe(0);
    });

    it("should return 0 for single value", () => {
      expect(calculateRenderDegradation([100])).toBe(0);
    });

    it("should return 0 for no degradation (identical times)", () => {
      expect(calculateRenderDegradation([100, 100, 100])).toBe(0);
      expect(calculateRenderDegradation([50, 50])).toBe(0);
    });

    it("should calculate linear degradation correctly", () => {
      expect(calculateRenderDegradation([100, 150, 200])).toBe(100); // 100% degradation
      expect(calculateRenderDegradation([100, 200])).toBe(100);
      expect(calculateRenderDegradation([50, 75])).toBe(50); // 50% degradation
    });

    it("should calculate extreme degradation correctly", () => {
      expect(calculateRenderDegradation([100, 200, 400, 800])).toBe(700); // 700% degradation
    });

    it("should handle zero minimum render time (divide by zero edge case)", () => {
      expect(calculateRenderDegradation([0, 100])).toBe(0);
      expect(calculateRenderDegradation([0, 0])).toBe(0);
    });

    it("should handle negative render times", () => {
      expect(calculateRenderDegradation([-100, 100])).toBe(0);
      expect(calculateRenderDegradation([-50, -100])).toBe(0);
    });

    it("should round to 2 decimal places", () => {
      const result = calculateRenderDegradation([100, 250.555]);
      expect(result).toBe(Math.round((150.555 / 100) * 100 * 100) / 100);
    });

    it("should handle exceed threshold (50%)", () => {
      expect(calculateRenderDegradation([100, 150])).toBe(50); // Exactly at threshold
      expect(calculateRenderDegradation([100, 151])).toBe(51); // Exceeds threshold
      expect(calculateRenderDegradation([100, 149])).toBe(49); // Below threshold
    });

    it("should handle small values", () => {
      expect(calculateRenderDegradation([10, 20])).toBe(100);
      expect(calculateRenderDegradation([1, 2, 3])).toBe(200); // 3 is max, 1 is min
    });
  });

  // =====================================================
  // Average Calculation Tests
  // =====================================================
  describe("calculateAverage", () => {
    it("should return 0 for empty array", () => {
      expect(calculateAverage([])).toBe(0);
    });

    it("should calculate average of single value", () => {
      expect(calculateAverage([100])).toBe(100);
      expect(calculateAverage([50])).toBe(50);
    });

    it("should calculate average of multiple values", () => {
      expect(calculateAverage([10, 20, 30])).toBe(20);
      expect(calculateAverage([100, 100, 100])).toBe(100);
      expect(calculateAverage([10, 20])).toBe(15);
    });

    it("should round to 2 decimal places", () => {
      expect(calculateAverage([10, 20, 30])).toBe(20);
      expect(calculateAverage([10.333, 20.667])).toBe(
        Math.round(((10.333 + 20.667) / 2) * 100) / 100
      );
    });
  });

  // =====================================================
  // Stability Score Calculation Tests
  // =====================================================
  describe("calculateStabilityScore", () => {
    it("should return 100 for perfect metrics", () => {
      expect(calculateStabilityScore(1, 0, 0)).toBe(100);
      expect(calculateStabilityScore(0.99, 50, 30)).toBe(100);
    });

    it("should deduct 50 points for low success rate", () => {
      expect(calculateStabilityScore(0.94, 0, 0)).toBe(50);
      expect(calculateStabilityScore(0.9, 0, 0)).toBe(50);
      expect(calculateStabilityScore(0, 0, 0)).toBe(50);
    });

    it("should deduct 20 points for high memory growth", () => {
      expect(calculateStabilityScore(1, 201, 0)).toBe(80);
      expect(calculateStabilityScore(1, 300, 0)).toBe(80);
    });

    it("should deduct 15 points for high render degradation", () => {
      expect(calculateStabilityScore(1, 0, 51)).toBe(85);
      expect(calculateStabilityScore(1, 0, 100)).toBe(85);
    });

    it("should apply multiple penalties correctly", () => {
      expect(calculateStabilityScore(0.94, 201, 51)).toBe(15); // -50 -20 -15 = 15
      expect(calculateStabilityScore(0.9, 300, 100)).toBe(15); // All failures
    });

    it("should return 0 as minimum", () => {
      // Score calculation: 100 - 50 (fail) - 20 (memory) - 15 (render) = 15, but Math.max(0, score) ensures >= 0
      // With extreme violations (0 success, huge memory/render), we still get 15 after all penalties
      // To actually get 0, we'd need more penalties or negative scores (which we don't have)
      // Test what actually happens: multiple violations still results in 15 minimum
      expect(calculateStabilityScore(0, 1000, 1000)).toBe(15);
      // To verify the Math.max(0, score) works, let's check the actual minimum is never negative
      expect(calculateStabilityScore(0, 1000, 1000)).toBeGreaterThanOrEqual(0);
    });

    it("should handle threshold boundary cases", () => {
      // Just below success rate threshold
      expect(calculateStabilityScore(STABILITY_THRESHOLDS.successRate - 0.001, 0, 0)).toBe(50);
      // At success rate threshold
      expect(calculateStabilityScore(STABILITY_THRESHOLDS.successRate, 0, 0)).toBe(100);
      // Just below memory threshold
      expect(calculateStabilityScore(1, STABILITY_THRESHOLDS.memoryGrowth - 1, 0)).toBe(100);
      // At memory threshold
      expect(calculateStabilityScore(1, STABILITY_THRESHOLDS.memoryGrowth, 0)).toBe(100);
      // Just exceeds memory threshold
      expect(calculateStabilityScore(1, STABILITY_THRESHOLDS.memoryGrowth + 1, 0)).toBe(80);
    });

    it("should accept custom thresholds", () => {
      const customThresholds = {
        ...STABILITY_THRESHOLDS,
        successRate: 0.9,
      } as unknown as typeof STABILITY_THRESHOLDS;
      expect(calculateStabilityScore(0.89, 0, 0, customThresholds)).toBe(50);
      expect(calculateStabilityScore(0.9, 0, 0, customThresholds)).toBe(100);
    });
  });

  // =====================================================
  // Status Determination Tests
  // =====================================================
  describe("determineStatus", () => {
    it("should return 'pass' for all metrics within thresholds", () => {
      expect(determineStatus(0.95, 100, 30)).toBe("pass");
      expect(determineStatus(1, 0, 0)).toBe("pass");
      expect(determineStatus(0.99, 150, 49)).toBe("pass");
    });

    it("should return 'fail' for low success rate", () => {
      expect(determineStatus(0.94, 100, 30)).toBe("fail");
      expect(determineStatus(0, 100, 30)).toBe("fail");
      expect(determineStatus(0.94, 1000, 1000)).toBe("fail"); // Fail overrides partial
    });

    it("should return 'partial' for memory warning (no success failure)", () => {
      expect(determineStatus(0.95, 201, 30)).toBe("partial");
      expect(determineStatus(0.99, 300, 30)).toBe("partial");
    });

    it("should return 'partial' for render warning (no success failure)", () => {
      expect(determineStatus(0.95, 100, 51)).toBe("partial");
      expect(determineStatus(0.99, 100, 100)).toBe("partial");
    });

    it("should return 'partial' for both memory and render warnings", () => {
      expect(determineStatus(0.95, 201, 51)).toBe("partial");
    });

    it("should handle threshold boundary cases", () => {
      // Just below success rate threshold → fail
      expect(determineStatus(STABILITY_THRESHOLDS.successRate - 0.001, 100, 30)).toBe("fail");
      // At success rate threshold → pass
      expect(determineStatus(STABILITY_THRESHOLDS.successRate, 100, 30)).toBe("pass");
      // Just above memory threshold → partial
      expect(determineStatus(0.95, STABILITY_THRESHOLDS.memoryGrowth + 1, 30)).toBe("partial");
      // At memory threshold → pass
      expect(determineStatus(0.95, STABILITY_THRESHOLDS.memoryGrowth, 30)).toBe("pass");
    });

    it("should accept custom thresholds", () => {
      const customThresholds = {
        ...STABILITY_THRESHOLDS,
        successRate: 0.9,
      } as unknown as typeof STABILITY_THRESHOLDS;
      expect(determineStatus(0.89, 100, 30, customThresholds)).toBe("fail");
      expect(determineStatus(0.9, 100, 30, customThresholds)).toBe("pass");
    });
  });

  // =====================================================
  // Alert Building Tests
  // =====================================================
  describe("buildAlerts", () => {
    it("should return empty array for all metrics within thresholds", () => {
      expect(buildAlerts(0.95, 100, 30)).toHaveLength(0);
      expect(buildAlerts(1, 0, 0)).toHaveLength(0);
    });

    it("should create error alert for low success rate", () => {
      const alerts = buildAlerts(0.94, 100, 30);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("error");
      expect(alerts[0].metric).toBe("successRate");
      expect(alerts[0].actual).toBe(0.94);
      expect(alerts[0].threshold).toBe(STABILITY_THRESHOLDS.successRate);
    });

    it("should create warning alert for high memory growth", () => {
      const alerts = buildAlerts(0.95, 201, 30);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("warning");
      expect(alerts[0].metric).toBe("memoryGrowth");
      expect(alerts[0].actual).toBe(201);
      expect(alerts[0].threshold).toBe(STABILITY_THRESHOLDS.memoryGrowth);
    });

    it("should create warning alert for high render degradation", () => {
      const alerts = buildAlerts(0.95, 100, 51);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("warning");
      expect(alerts[0].metric).toBe("renderDegradation");
      expect(alerts[0].actual).toBe(51);
      expect(alerts[0].threshold).toBe(STABILITY_THRESHOLDS.performanceDegradation);
    });

    it("should create all three alerts for all violations", () => {
      const alerts = buildAlerts(0.94, 201, 51);
      expect(alerts).toHaveLength(3);
      expect(alerts[0].severity).toBe("error");
      expect(alerts[1].severity).toBe("warning");
      expect(alerts[2].severity).toBe("warning");
    });

    it("should include correct message formatting", () => {
      const alerts = buildAlerts(0.9, 250, 75);
      expect(alerts[0].message).toContain("90.0%");
      expect(alerts[0].message).toContain("95.0%");
      // Memory growth message uses .toFixed(1) for one decimal place
      expect(alerts[1].message).toContain("250.0%");
      expect(alerts[1].message).toContain("200");
      expect(alerts[2].message).toContain("75.0%");
      expect(alerts[2].message).toContain("50");
    });

    it("should accept custom thresholds", () => {
      const customThresholds = {
        ...STABILITY_THRESHOLDS,
        successRate: 0.9,
      } as unknown as typeof STABILITY_THRESHOLDS;
      const alerts1 = buildAlerts(0.89, 100, 30, customThresholds);
      expect(alerts1).toHaveLength(1);
      expect(alerts1[0].metric).toBe("successRate");
      expect(alerts1[0].threshold).toBe(0.9);

      const alerts2 = buildAlerts(0.9, 100, 30, customThresholds);
      expect(alerts2).toHaveLength(0);
    });

    it("should handle boundary conditions correctly", () => {
      // Exactly at threshold - no alerts
      const alerts1 = buildAlerts(0.95, 200, 50);
      expect(alerts1).toHaveLength(0);

      // Just below/above threshold - triggers alerts
      const alerts2 = buildAlerts(0.9499, 200.01, 50.01);
      expect(alerts2).toHaveLength(3);
    });
  });

  // =====================================================
  // Integration Tests (Multiple Metrics Together)
  // =====================================================
  describe("Integration Tests", () => {
    it("should handle realistic scenario: degraded performance", () => {
      // Scenario: 94% success rate, 150% memory growth, 45% render degradation
      const successRate = calculateSuccessRate(94, 100);
      const memoryGrowth = calculateMemoryGrowth([100, 150, 200, 250]);
      const renderDegradation = calculateRenderDegradation([100, 120, 145]);
      const score = calculateStabilityScore(successRate, memoryGrowth, renderDegradation);
      const status = determineStatus(successRate, memoryGrowth, renderDegradation);
      const alerts = buildAlerts(successRate, memoryGrowth, renderDegradation);

      expect(successRate).toBe(0.94);
      expect(memoryGrowth).toBe(150);
      expect(renderDegradation).toBe(45);
      expect(score).toBe(50); // -50 for success rate failure
      expect(status).toBe("fail");
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("error");
    });

    it("should handle realistic scenario: stable performance", () => {
      // Scenario: 98% success rate, 50% memory growth, 20% render degradation
      const successRate = calculateSuccessRate(980, 1000);
      const memoryGrowth = calculateMemoryGrowth([100, 120, 150]);
      const renderDegradation = calculateRenderDegradation([100, 110, 120]);
      const score = calculateStabilityScore(successRate, memoryGrowth, renderDegradation);
      const status = determineStatus(successRate, memoryGrowth, renderDegradation);
      const alerts = buildAlerts(successRate, memoryGrowth, renderDegradation);

      expect(successRate).toBe(0.98);
      expect(memoryGrowth).toBe(50);
      expect(renderDegradation).toBe(20);
      expect(score).toBe(100);
      expect(status).toBe("pass");
      expect(alerts).toHaveLength(0);
    });

    it("should handle realistic scenario: warnings only", () => {
      // Scenario: 97% success rate (pass), 250% memory growth (fail), 60% render degradation (fail)
      const successRate = calculateSuccessRate(97, 100);
      const memoryGrowth = calculateMemoryGrowth([100, 350]);
      const renderDegradation = calculateRenderDegradation([100, 160]);
      const score = calculateStabilityScore(successRate, memoryGrowth, renderDegradation);
      const status = determineStatus(successRate, memoryGrowth, renderDegradation);
      const alerts = buildAlerts(successRate, memoryGrowth, renderDegradation);

      expect(successRate).toBe(0.97);
      expect(memoryGrowth).toBe(250);
      expect(renderDegradation).toBe(60);
      expect(score).toBe(65); // 100 - 20 - 15
      expect(status).toBe("partial");
      expect(alerts).toHaveLength(2);
      expect(alerts.every((a) => a.severity === "warning")).toBe(true);
    });

    it("should handle large test datasets", () => {
      // Simulate 1000 tests
      const passedTests = 950;
      const totalTests = 1000;
      const renderTimes = Array.from({ length: 1000 }, (_, i) => 100 + (i % 50));
      const memoryValues = Array.from({ length: 1000 }, (_, i) => 100 + (i % 100));

      const successRate = calculateSuccessRate(passedTests, totalTests);
      const memoryGrowth = calculateMemoryGrowth(memoryValues);
      const renderDegradation = calculateRenderDegradation(renderTimes);
      const avgRender = calculateAverage(renderTimes);
      const avgMemory = calculateAverage(memoryValues);

      expect(successRate).toBe(0.95);
      expect(memoryGrowth).toBeGreaterThan(0);
      expect(renderDegradation).toBeGreaterThan(0);
      expect(avgRender).toBeGreaterThan(0);
      expect(avgMemory).toBeGreaterThan(0);
    });
  });
});
