/**
 * Stability Metrics Calculation Utilities
 *
 * Framework-agnostic functions for calculating stability metrics from test data.
 * These functions are designed to be unit-tested and reusable across test runners.
 *
 * @module utils/stability-metrics
 */

/**
 * Acceptance criteria thresholds for stability metrics
 */
export const STABILITY_THRESHOLDS = {
  successRate: 0.95, // 95% success rate required
  memoryGrowth: 200, // Allow up to 200% memory growth
  performanceDegradation: 50, // Allow up to 50% render time degradation
  websocketStability: 100, // 100% websocket stability required
} as const;

/**
 * Calculate success rate from test counts
 *
 * @param passedTests - Number of passed tests
 * @param totalTests - Total number of tests
 * @returns Success rate as decimal (0-1)
 *
 * @example
 * calculateSuccessRate(95, 100) // Returns 0.95
 * calculateSuccessRate(0, 0) // Returns 0 (no tests edge case)
 */
export function calculateSuccessRate(passedTests: number, totalTests: number): number {
  if (totalTests === 0) return 0;
  return passedTests / totalTests;
}

/**
 * Calculate memory growth percentage
 *
 * @param memoryValues - Array of memory readings (in MB)
 * @returns Memory growth percentage, or 0 if insufficient data
 *
 * @example
 * calculateMemoryGrowth([100, 150, 200]) // Returns 100 (100% growth from min to max)
 * calculateMemoryGrowth([]) // Returns 0 (no data)
 * calculateMemoryGrowth([100, 100, 100]) // Returns 0 (no growth)
 */
export function calculateMemoryGrowth(memoryValues: number[]): number {
  if (memoryValues.length === 0) return 0;
  if (memoryValues.length === 1) return 0;

  const minMemory = Math.min(...memoryValues);
  const maxMemory = Math.max(...memoryValues);

  if (minMemory === 0 || minMemory < 0) return 0;

  const growth = ((maxMemory - minMemory) / minMemory) * 100;
  return Math.round(growth * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate render performance degradation percentage
 *
 * @param renderTimes - Array of render times (in milliseconds)
 * @returns Degradation percentage, or 0 if insufficient data
 *
 * @example
 * calculateRenderDegradation([100, 150, 200]) // Returns 100
 * calculateRenderDegradation([]) // Returns 0
 * calculateRenderDegradation([100]) // Returns 0 (single sample)
 */
export function calculateRenderDegradation(renderTimes: number[]): number {
  if (renderTimes.length === 0) return 0;
  if (renderTimes.length === 1) return 0;

  const minRenderTime = Math.min(...renderTimes);
  const maxRenderTime = Math.max(...renderTimes);

  if (minRenderTime === 0 || minRenderTime < 0) return 0;

  const degradation = ((maxRenderTime - minRenderTime) / minRenderTime) * 100;
  return Math.round(degradation * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate average of numeric array
 *
 * @param values - Array of numbers
 * @returns Average value, or 0 if array is empty
 *
 * @example
 * calculateAverage([10, 20, 30]) // Returns 20
 * calculateAverage([]) // Returns 0
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/**
 * Calculate overall stability score
 *
 * Starts at 100 and deducts points based on metric violations:
 * - Success rate below threshold: -50 points
 * - Memory growth above threshold: -20 points
 * - Render degradation above threshold: -15 points
 *
 * @param successRate - Success rate as decimal (0-1)
 * @param memoryGrowth - Memory growth percentage
 * @param renderDegradation - Render degradation percentage
 * @param thresholds - Optional custom thresholds
 * @returns Stability score (0-100)
 *
 * @example
 * calculateStabilityScore(0.95, 100, 30) // Returns 100 (all within thresholds)
 * calculateStabilityScore(0.90, 250, 60) // Returns 15 (all penalties applied)
 * calculateStabilityScore(0.94, 100, 30) // Returns 50 (success rate penalty)
 */
export function calculateStabilityScore(
  successRate: number,
  memoryGrowth: number,
  renderDegradation: number,
  thresholds = STABILITY_THRESHOLDS
): number {
  let score = 100;

  if (successRate < thresholds.successRate) {
    score -= 50;
  }

  if (memoryGrowth > thresholds.memoryGrowth) {
    score -= 20;
  }

  if (renderDegradation > thresholds.performanceDegradation) {
    score -= 15;
  }

  return Math.max(0, score);
}

/**
 * Determine overall status based on metric thresholds
 *
 * @param successRate - Success rate as decimal (0-1)
 * @param memoryGrowth - Memory growth percentage
 * @param renderDegradation - Render degradation percentage
 * @param thresholds - Optional custom thresholds
 * @returns Status: "pass" (all OK), "partial" (warnings), or "fail" (errors)
 *
 * @example
 * determineStatus(0.95, 100, 30) // Returns "pass"
 * determineStatus(0.94, 100, 30) // Returns "fail"
 * determineStatus(0.95, 250, 30) // Returns "partial"
 */
export function determineStatus(
  successRate: number,
  memoryGrowth: number,
  renderDegradation: number,
  thresholds = STABILITY_THRESHOLDS
): "pass" | "fail" | "partial" {
  const successFail = successRate < thresholds.successRate;
  const memoryWarning = memoryGrowth > thresholds.memoryGrowth;
  const renderWarning = renderDegradation > thresholds.performanceDegradation;

  if (successFail) return "fail";
  if (memoryWarning || renderWarning) return "partial";
  return "pass";
}

/**
 * Build alerts array based on metric violations
 *
 * @param successRate - Success rate as decimal (0-1)
 * @param memoryGrowth - Memory growth percentage
 * @param renderDegradation - Render degradation percentage
 * @param thresholds - Optional custom thresholds
 * @returns Array of alert objects
 *
 * @example
 * buildAlerts(0.90, 250, 60)
 * // Returns [
 * //   { severity: "error", message: "Success rate...", metric: "successRate", ... },
 * //   { severity: "warning", message: "Memory growth...", metric: "memoryGrowth", ... },
 * //   { severity: "warning", message: "Render performance...", metric: "renderDegradation", ... }
 * // ]
 */
export function buildAlerts(
  successRate: number,
  memoryGrowth: number,
  renderDegradation: number,
  thresholds = STABILITY_THRESHOLDS
): Array<{
  severity: "error" | "warning" | "info";
  message: string;
  metric: string;
  threshold: number;
  actual: number;
}> {
  const alerts: Array<{
    severity: "error" | "warning" | "info";
    message: string;
    metric: string;
    threshold: number;
    actual: number;
  }> = [];

  if (successRate < thresholds.successRate) {
    alerts.push({
      severity: "error",
      message: `Success rate (${(successRate * 100).toFixed(1)}%) below threshold (${(thresholds.successRate * 100).toFixed(1)}%)`,
      metric: "successRate",
      threshold: thresholds.successRate,
      actual: successRate,
    });
  }

  if (memoryGrowth > thresholds.memoryGrowth) {
    alerts.push({
      severity: "warning",
      message: `Memory growth (${memoryGrowth.toFixed(1)}%) exceeds threshold (${thresholds.memoryGrowth}%)`,
      metric: "memoryGrowth",
      threshold: thresholds.memoryGrowth,
      actual: memoryGrowth,
    });
  }

  if (renderDegradation > thresholds.performanceDegradation) {
    alerts.push({
      severity: "warning",
      message: `Render performance degradation (${renderDegradation.toFixed(1)}%) exceeds threshold (${thresholds.performanceDegradation}%)`,
      metric: "renderDegradation",
      threshold: thresholds.performanceDegradation,
      actual: renderDegradation,
    });
  }

  return alerts;
}
