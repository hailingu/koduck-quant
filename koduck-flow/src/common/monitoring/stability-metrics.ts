/**
 * @module src/common/monitoring/stability-metrics
 * @description Stability metrics tracking and alerting for test suite health.
 *
 * Provides utilities to:
 * - Summarize stability reports into trend entries
 * - Maintain a sliding-window history of stability metrics
 * - Detect stability degradation via configurable thresholds
 *
 * Key Concepts:
 * - **StabilityRun**: A single test run with pass/fail/skip counts
 * - **StabilityTrendEntry**: Aggregated snapshot of stability metrics at a point in time
 * - **StabilityAlert**: Warning when error rate or stability score breaches threshold
 *
 * @example
 * ```typescript
 * import {
 *   summariseStability,
 *   updateStabilityTrend,
 * } from '@/common/monitoring/stability-metrics';
 *
 * const entry = summariseStability(report);
 * const trend = updateStabilityTrend(undefined, entry, { errorThreshold: 0.01 });
 * console.log(trend.alerts);
 * ```
 */

import { randomUUID } from "node:crypto";

/**
 * A single test run result within a stability report.
 *
 * Contains counts for passed, failed, skipped tests and computed success rate.
 */
export interface StabilityRun {
  runId: number;
  timestamp: string;
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  successRate: number;
  failedTests: string[];
}

/**
 * Summary statistics aggregated from multiple stability runs.
 */
export interface StabilityReportSummary {
  totalRuns: number;
  averageSuccessRate: number;
  minSuccessRate: number;
  maxSuccessRate: number;
  averageDuration: number;
  stabilityScore: number;
  flakyTests: string[];
}

/**
 * A complete stability report containing summary and individual runs.
 */
export interface StabilityReport {
  summary: StabilityReportSummary;
  runs: StabilityRun[];
  recommendations?: string[];
}

/**
 * A timestamped snapshot of stability metrics for trend tracking.
 */
export interface StabilityTrendEntry {
  id: string;
  timestamp: string;
  averageSuccessRate: number;
  averageErrorRate: number;
  stabilityScore: number;
  flakyTests: number;
}

/**
 * Alert raised when stability metrics breach configured thresholds.
 */
export interface StabilityAlert {
  message: string;
  severity: "warning" | "critical";
  metric: "errorRate" | "stabilityScore";
  value: number;
  threshold: number;
}

/**
 * Aggregated stability trend data structure.
 *
 * Maintains a sliding window of {@link StabilityTrendEntry} records and any active {@link StabilityAlert}s.
 */
export interface StabilityTrend {
  version: number;
  generatedAt: string;
  windowSize: number;
  entries: StabilityTrendEntry[];
  alerts: StabilityAlert[];
}

/**
 * Options for configuring stability trend thresholds and window size.
 */
export interface StabilityOptions {
  errorThreshold?: number;
  stabilityScoreThreshold?: number;
  windowSize?: number;
}

/** Default error rate threshold (0.1%). */
const DEFAULT_ERROR_THRESHOLD = 0.001;

/** Default minimum acceptable stability score. */
const DEFAULT_STABILITY_SCORE_THRESHOLD = 90;

/** Default number of entries to retain in trend history. */
const DEFAULT_WINDOW_SIZE = 30;

/**
 * Rounds a number to 6 decimal places for consistent storage.
 * @param value - The numeric value to round
 * @returns Rounded number
 * @internal
 */
function toFixed(value: number): number {
  return Number.parseFloat(value.toFixed(6));
}

/**
 * Creates a stability trend entry from a stability report summary.
 *
 * @param report - The stability report to summarize
 * @returns A new {@link StabilityTrendEntry} with derived metrics
 *
 * @example
 * ```typescript
 * const entry = summariseStability(report);
 * console.log(entry.stabilityScore, entry.averageErrorRate);
 * ```
 */
export function summariseStability(report: StabilityReport): StabilityTrendEntry {
  const averageSuccessRate = report.summary?.averageSuccessRate ?? 0;
  const averageErrorRate = Math.max(0, 1 - averageSuccessRate);
  const stabilityScore = report.summary?.stabilityScore ?? 0;
  const flakyTests = report.summary?.flakyTests?.length ?? 0;

  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    averageSuccessRate: toFixed(averageSuccessRate),
    averageErrorRate: toFixed(averageErrorRate),
    stabilityScore: toFixed(stabilityScore),
    flakyTests,
  };
}

/**
 * Ensures a valid StabilityTrend object exists, creating one if necessary.
 * @param trend - Existing trend or undefined
 * @param windowSize - Window size for new trend
 * @returns Initialized or existing trend
 * @internal
 */
function ensureTrend(trend?: StabilityTrend, windowSize = DEFAULT_WINDOW_SIZE): StabilityTrend {
  if (trend) {
    return {
      ...trend,
      windowSize,
    };
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    windowSize,
    entries: [],
    alerts: [],
  };
}

/**
 * Trims entries to maintain window size, keeping most recent.
 * @param entries - Full entry list
 * @param windowSize - Maximum entries to retain
 * @returns Trimmed entry list
 * @internal
 */
function trimEntries(entries: StabilityTrendEntry[], windowSize: number): StabilityTrendEntry[] {
  if (entries.length <= windowSize) {
    return entries;
  }

  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return sorted.slice(-windowSize);
}

/**
 * Evaluates stability entry against thresholds and generates alerts.
 * @param entry - The entry to evaluate
 * @param options - Threshold configuration
 * @returns Array of alerts for any breached thresholds
 * @internal
 */
function evaluateAlerts(entry: StabilityTrendEntry, options: StabilityOptions): StabilityAlert[] {
  const errorThreshold = options.errorThreshold ?? DEFAULT_ERROR_THRESHOLD;
  const stabilityThreshold = options.stabilityScoreThreshold ?? DEFAULT_STABILITY_SCORE_THRESHOLD;

  const alerts: StabilityAlert[] = [];

  if (entry.averageErrorRate > errorThreshold) {
    alerts.push({
      message: `Average error rate ${(entry.averageErrorRate * 100).toFixed(3)}% exceeds ${(errorThreshold * 100).toFixed(3)}% threshold`,
      severity: entry.averageErrorRate > errorThreshold * 2 ? "critical" : "warning",
      metric: "errorRate",
      value: toFixed(entry.averageErrorRate),
      threshold: toFixed(errorThreshold),
    });
  }

  if (entry.stabilityScore < stabilityThreshold) {
    alerts.push({
      message: `Stability score ${entry.stabilityScore.toFixed(2)} below threshold ${stabilityThreshold.toFixed(2)}`,
      severity: entry.stabilityScore < stabilityThreshold * 0.8 ? "critical" : "warning",
      metric: "stabilityScore",
      value: toFixed(entry.stabilityScore),
      threshold: toFixed(stabilityThreshold),
    });
  }

  return alerts;
}

/**
 * Updates the stability trend with a new entry and evaluates alerts.
 *
 * Appends the entry, trims history based on window size, and checks thresholds.
 *
 * @param trend - Existing trend or undefined to create new
 * @param entry - New trend entry to add
 * @param options - Optional threshold and window configuration
 * @returns Updated trend with new entry and any stability alerts
 *
 * @example
 * ```typescript
 * let trend = updateStabilityTrend(undefined, entry1);
 * trend = updateStabilityTrend(trend, entry2, { errorThreshold: 0.005 });
 * if (trend.alerts.length > 0) {
 *   console.warn('Stability degradation detected');
 * }
 * ```
 */
export function updateStabilityTrend(
  trend: StabilityTrend | undefined,
  entry: StabilityTrendEntry,
  options: StabilityOptions = {}
): StabilityTrend {
  const windowSize = options.windowSize ?? trend?.windowSize ?? DEFAULT_WINDOW_SIZE;
  const prepared = ensureTrend(trend, windowSize);
  const nextEntries = trimEntries([...prepared.entries, entry], windowSize);
  const alerts = evaluateAlerts(entry, options);

  return {
    version: prepared.version,
    generatedAt: new Date().toISOString(),
    windowSize,
    entries: nextEntries,
    alerts,
  };
}
