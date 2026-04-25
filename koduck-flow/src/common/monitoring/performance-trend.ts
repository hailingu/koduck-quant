/**
 * @module src/common/monitoring/performance-trend
 * @description Performance trend tracking and regression detection for benchmark analysis.
 *
 * Provides utilities to:
 * - Derive metrics from benchmark scenario results
 * - Maintain a sliding-window history of trend entries
 * - Detect performance regressions against baselines
 * - Generate human-readable digest reports
 *
 * Key Concepts:
 * - **TrendEntry**: A timestamped snapshot of scenario metrics
 * - **TrendAlert**: A regression notification when metrics deviate beyond threshold
 * - **PerformanceTrend**: Aggregated history with alerts and window-based trimming
 *
 * @example
 * ```typescript
 * import {
 *   createTrendEntry,
 *   updatePerformanceTrend,
 *   generateMonthlyDigest,
 * } from '@/common/monitoring/performance-trend';
 *
 * const entry = createTrendEntry({ scenario: 'render', totalDurationMs: 120 });
 * const trend = updatePerformanceTrend(undefined, entry, { windowSize: 30 });
 * const digest = generateMonthlyDigest(trend);
 * ```
 */

import { randomUUID } from "node:crypto";

/**
 * A single sample within a benchmark scenario.
 *
 * Represents one measurement point (e.g., a single iteration or operation batch).
 */
export interface BenchmarkSample {
  label: string;
  operations?: number;
  durationMs?: number;
  throughput?: number;
}

/**
 * Result of a single benchmark scenario execution.
 *
 * Contains aggregated timing, optional samples, and custom metrics/details.
 */
export interface BenchmarkScenarioResult {
  scenario: string;
  totalDurationMs?: number;
  samples?: BenchmarkSample[];
  details?: Record<string, unknown> | undefined;
  metrics?: Record<string, number> | undefined;
}

/**
 * A collection of benchmark scenario results, typically output by a benchmark runner.
 */
export interface BenchmarkReport {
  generatedAt?: string;
  results: BenchmarkScenarioResult[];
}

/**
 * A historical record of derived metrics for a specific scenario.
 *
 * Each entry captures a unique snapshot in time, used for trend comparison.
 */
export interface TrendEntry {
  id: string;
  scenario: string;
  timestamp: string;
  metrics: Record<string, number>;
}

/**
 * Alert raised when a metric regresses beyond the configured threshold.
 *
 * Provides context including baseline vs current values and severity level.
 */
export interface TrendAlert {
  scenario: string;
  metric: string;
  baseline: number;
  current: number;
  changePercent: number;
  direction: "increase" | "decrease";
  severity: "warning" | "critical";
  message: string;
}

/**
 * Aggregated performance trend data structure.
 *
 * Maintains a sliding window of {@link TrendEntry} records and any active {@link TrendAlert}s.
 */
export interface PerformanceTrend {
  version: number;
  generatedAt: string;
  windowSize: number;
  entries: TrendEntry[];
  alerts: TrendAlert[];
}

/**
 * Options for controlling trend window size and regression sensitivity.
 */
export interface TrendOptions {
  windowSize?: number;
  regressionThresholdPercent?: number;
}

/** Default number of entries to retain in trend history. */
const DEFAULT_WINDOW_SIZE = 30;

/** Default regression threshold (5% change triggers alert). */
const DEFAULT_REGRESSION_THRESHOLD = 0.05;

/**
 * Keywords indicating that lower metric values represent better performance.
 * @internal
 */
const LOWER_IS_BETTER_KEYWORDS = [
  "duration",
  "latency",
  "time",
  "error",
  "errors",
  "fail",
  "failed",
  "penalty",
];

/**
 * Keywords indicating that higher metric values represent better performance.
 * @internal
 */
const HIGHER_IS_BETTER_KEYWORDS = ["throughput", "gain", "success", "score"];

/**
 * Rounds a number to 6 decimal places for consistent storage.
 * @param value - The numeric value to round
 * @returns Rounded number
 * @internal
 */
function toFixedNumber(value: number): number {
  return Number.parseFloat(value.toFixed(6));
}

/**
 * Determines if a metric name indicates lower values are better.
 *
 * @param metricName - The metric name to evaluate
 * @returns `true` if lower values represent improvement
 *
 * @example
 * ```typescript
 * isLowerBetterMetric('avgDurationMs'); // true
 * isLowerBetterMetric('throughput');    // false
 * ```
 */
export function isLowerBetterMetric(metricName: string): boolean {
  const lowered = metricName.toLowerCase();
  return LOWER_IS_BETTER_KEYWORDS.some((keyword) => lowered.includes(keyword));
}

/**
 * Determines if a metric name indicates higher values are better.
 *
 * @param metricName - The metric name to evaluate
 * @returns `true` if higher values represent improvement
 *
 * @example
 * ```typescript
 * isHigherBetterMetric('throughput'); // true
 * isHigherBetterMetric('latency');    // false
 * ```
 */
export function isHigherBetterMetric(metricName: string): boolean {
  const lowered = metricName.toLowerCase();
  return HIGHER_IS_BETTER_KEYWORDS.some((keyword) => lowered.includes(keyword));
}

/**
 * Recursively extracts numeric values from a details object and appends them to target.
 * @param target - Metrics map to populate
 * @param source - Details object with nested numeric values
 * @internal
 */
function appendDetailMetrics(
  target: Record<string, number>,
  source: Record<string, unknown> | undefined
): void {
  if (!source) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number") {
      target[`detail:${key}`] = toFixedNumber(value);
      continue;
    }

    if (Array.isArray(value) || value === null || typeof value !== "object") {
      continue;
    }

    appendDetailMetrics(target, value as Record<string, unknown>);
  }
}

/**
 * Appends custom metrics with a `metric:` prefix.
 * @param target - Metrics map to populate
 * @param source - Custom metrics record
 * @internal
 */
function appendCustomMetrics(
  target: Record<string, number>,
  source: Record<string, number> | undefined
): void {
  if (!source) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number") {
      target[`metric:${key}`] = toFixedNumber(value);
    }
  }
}

/**
 * Extracts throughput and duration metrics from samples.
 * @param target - Metrics map to populate
 * @param samples - Array of benchmark samples
 * @returns Extracted throughput and duration arrays for aggregation
 * @internal
 */
function appendSampleMetrics(
  target: Record<string, number>,
  samples: BenchmarkSample[] | undefined
): { throughputs: number[]; durations: number[] } {
  const throughputs: number[] = [];
  const durations: number[] = [];

  for (const sample of samples ?? []) {
    if (typeof sample.throughput === "number") {
      throughputs.push(sample.throughput);
      target[`${sample.label}:throughput`] = toFixedNumber(sample.throughput);
    }

    if (typeof sample.durationMs === "number") {
      durations.push(sample.durationMs);
      target[`${sample.label}:durationMs`] = toFixedNumber(sample.durationMs);
    }
  }

  return { throughputs, durations };
}

/**
 * Derives a flat metrics record from a benchmark scenario result.
 *
 * Aggregates sample data, computes averages and maximums, and includes
 * any custom metrics or nested details.
 *
 * @param result - The benchmark scenario result to process
 * @returns Flat record of metric name to numeric value
 *
 * @example
 * ```typescript
 * const metrics = deriveMetrics({
 *   scenario: 'render',
 *   totalDurationMs: 100,
 *   samples: [{ label: 'frame', throughput: 60 }],
 * });
 * // { totalDurationMs: 100, 'frame:throughput': 60, avgThroughput: 60, maxThroughput: 60 }
 * ```
 */
export function deriveMetrics(result: BenchmarkScenarioResult): Record<string, number> {
  const metrics: Record<string, number> = {};

  if (typeof result.totalDurationMs === "number") {
    metrics.totalDurationMs = toFixedNumber(result.totalDurationMs);
  }

  const { throughputs, durations } = appendSampleMetrics(metrics, result.samples);

  if (throughputs.length > 0) {
    const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
    metrics.avgThroughput = toFixedNumber(avgThroughput);
    metrics.maxThroughput = toFixedNumber(Math.max(...throughputs));
  }

  if (durations.length > 0) {
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    metrics.avgDurationMs = toFixedNumber(avgDuration);
    metrics.maxDurationMs = toFixedNumber(Math.max(...durations));
  }

  appendDetailMetrics(metrics, result.details);
  appendCustomMetrics(metrics, result.metrics);

  return metrics;
}

/**
 * Creates a new trend entry from a benchmark scenario result.
 *
 * @param result - The scenario result to convert
 * @param timestamp - Optional ISO timestamp (defaults to now)
 * @returns A new {@link TrendEntry} with derived metrics
 *
 * @example
 * ```typescript
 * const entry = createTrendEntry({ scenario: 'api', totalDurationMs: 50 });
 * ```
 */
export function createTrendEntry(
  result: BenchmarkScenarioResult,
  timestamp = new Date().toISOString()
): TrendEntry {
  return {
    id: randomUUID(),
    scenario: result.scenario,
    timestamp,
    metrics: deriveMetrics(result),
  };
}

/**
 * Ensures a valid PerformanceTrend object exists, creating one if necessary.
 * @param trend - Existing trend or undefined
 * @param windowSize - Window size for new trend
 * @returns Initialized or existing trend
 * @internal
 */
function ensureTrend(trend?: PerformanceTrend, windowSize = DEFAULT_WINDOW_SIZE): PerformanceTrend {
  if (trend) {
    return {
      ...trend,
      windowSize: windowSize ?? trend.windowSize ?? DEFAULT_WINDOW_SIZE,
    };
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    windowSize: windowSize ?? DEFAULT_WINDOW_SIZE,
    entries: [],
    alerts: [],
  };
}

/**
 * Determines if an entry should be trimmed from history based on window size.
 * @param entry - The entry to evaluate
 * @param scenario - Scenario name for filtering
 * @param history - Full entry history
 * @param windowSize - Maximum entries to retain per scenario
 * @returns `true` if entry should be removed
 * @internal
 */
function shouldTrimEntry(
  entry: TrendEntry,
  scenario: string,
  history: TrendEntry[],
  windowSize: number
): boolean {
  if (entry.scenario !== scenario) {
    return false;
  }

  const scenarioEntries = history
    .filter((item) => item.scenario === scenario)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (scenarioEntries.length <= windowSize) {
    return false;
  }

  const oldestAllowed = scenarioEntries.length - windowSize;
  const entriesSorted = scenarioEntries
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const entriesToTrim = new Set(entriesSorted.slice(0, oldestAllowed).map((item) => item.id));

  return entriesToTrim.has(entry.id);
}

/**
 * Determines alert severity based on how much change exceeds threshold.
 * @param changePercent - Relative change percentage
 * @param threshold - Base threshold for warning
 * @returns `critical` if change exceeds 2x threshold, otherwise `warning`
 * @internal
 */
function determineSeverity(changePercent: number, threshold: number): "warning" | "critical" {
  return Math.abs(changePercent) >= threshold * 2 ? "critical" : "warning";
}

/**
 * Computes percentage change from baseline to current value.
 * @param current - Current metric value
 * @param baseline - Previous metric value
 * @returns Change as decimal (0.05 = 5%), or undefined if invalid
 * @internal
 */
function computeChangePercent(current: number, baseline: number): number | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) {
    return undefined;
  }

  return (current - baseline) / Math.abs(baseline);
}

/**
 * Constructs a TrendAlert if a regression condition is met.
 * @param scenario - Scenario name
 * @param metric - Metric name
 * @param baseline - Baseline value
 * @param current - Current value
 * @param changePercent - Computed change percentage
 * @param threshold - Regression threshold
 * @param regressionOnIncrease - If `true`, increase is regression; otherwise decrease is regression
 * @returns Alert object or undefined if no regression
 * @internal
 */
function buildAlert(
  scenario: string,
  metric: string,
  baseline: number,
  current: number,
  changePercent: number,
  threshold: number,
  regressionOnIncrease: boolean
): TrendAlert | undefined {
  const isRegression = regressionOnIncrease
    ? changePercent > threshold
    : changePercent < -threshold;

  if (!isRegression) {
    return undefined;
  }

  const direction: "increase" | "decrease" = changePercent >= 0 ? "increase" : "decrease";
  const severity = determineSeverity(changePercent, threshold);
  const formattedPercent = (Math.abs(changePercent) * 100).toFixed(2);

  const directionLabel = regressionOnIncrease ? "increase" : "decrease";
  const comparator = regressionOnIncrease ? "above" : "below";

  return {
    scenario,
    metric,
    baseline: toFixedNumber(baseline),
    current: toFixedNumber(current),
    changePercent: toFixedNumber(changePercent),
    direction,
    severity,
    message: `Metric "${metric}" changed ${formattedPercent}% ${comparator} baseline (${directionLabel}).`,
  };
}

/**
 * Evaluates whether a metric change constitutes a regression.
 * @param scenario - Scenario name
 * @param metric - Metric name
 * @param baseline - Previous value
 * @param current - Current value
 * @param threshold - Regression threshold
 * @returns Alert if regression detected, otherwise undefined
 * @internal
 */
function evaluateRegression(
  scenario: string,
  metric: string,
  baseline: number,
  current: number,
  threshold: number
): TrendAlert | undefined {
  const changePercent = computeChangePercent(current, baseline);
  if (changePercent === undefined) {
    return undefined;
  }

  if (isLowerBetterMetric(metric)) {
    return buildAlert(scenario, metric, baseline, current, changePercent, threshold, true);
  }

  if (isHigherBetterMetric(metric)) {
    return buildAlert(scenario, metric, baseline, current, changePercent, threshold, false);
  }

  // Default behaviour: treat improvement as lower duration or higher throughput according to change sign
  const regressionOnIncrease =
    metric.toLowerCase().includes("duration") || metric.toLowerCase().includes("time");
  return buildAlert(
    scenario,
    metric,
    baseline,
    current,
    changePercent,
    threshold,
    regressionOnIncrease
  );
}

/**
 * Updates the performance trend with a new entry and detects regressions.
 *
 * Appends the entry, trims history based on window size, and compares against
 * the most recent previous entry for the same scenario to generate alerts.
 *
 * @param trend - Existing trend or undefined to create new
 * @param entry - New trend entry to add
 * @param options - Optional window size and threshold configuration
 * @returns Updated trend with new entry and any regression alerts
 *
 * @example
 * ```typescript
 * let trend = updatePerformanceTrend(undefined, entry1);
 * trend = updatePerformanceTrend(trend, entry2, { regressionThresholdPercent: 0.1 });
 * console.log(trend.alerts); // Any detected regressions
 * ```
 */
export function updatePerformanceTrend(
  trend: PerformanceTrend | undefined,
  entry: TrendEntry,
  options?: TrendOptions
): PerformanceTrend {
  const windowSize = options?.windowSize ?? trend?.windowSize ?? DEFAULT_WINDOW_SIZE;
  const threshold = options?.regressionThresholdPercent ?? DEFAULT_REGRESSION_THRESHOLD;

  const preparedTrend = ensureTrend(trend, windowSize);
  const nextEntries = [...preparedTrend.entries, entry];

  const filteredEntries = nextEntries.filter(
    (item) => !shouldTrimEntry(item, item.scenario, nextEntries, windowSize)
  );

  const previousEntry = [...filteredEntries]
    .filter((item) => item.scenario === entry.scenario && item.id !== entry.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  const alerts: TrendAlert[] = [];

  if (previousEntry) {
    for (const [metric, currentValue] of Object.entries(entry.metrics)) {
      const baselineValue = previousEntry.metrics[metric];
      if (typeof baselineValue !== "number") {
        continue;
      }

      const alert = evaluateRegression(
        entry.scenario,
        metric,
        baselineValue,
        currentValue,
        threshold
      );
      if (alert) {
        alerts.push(alert);
      }
    }
  }

  return {
    version: preparedTrend.version,
    generatedAt: new Date().toISOString(),
    windowSize,
    entries: filteredEntries,
    alerts,
  };
}

/**
 * Options for generating a performance digest report.
 */
export interface DigestOptions {
  scenarios?: string[];
  maxAlerts?: number;
}

/**
 * Filters entries by scenario names (case-insensitive).
 * @param entries - Full entry list
 * @param scenarios - Optional scenario filter
 * @returns Filtered entries
 * @internal
 */
function selectEntries(entries: TrendEntry[], scenarios?: string[]): TrendEntry[] {
  if (!scenarios || scenarios.length === 0) {
    return entries;
  }

  const lookup = new Set(scenarios.map((name) => name.trim().toLowerCase()));
  return entries.filter((entry) => lookup.has(entry.scenario.toLowerCase()));
}

/**
 * Generates a Markdown digest summarizing latest metrics and regressions.
 *
 * @param trend - The performance trend data
 * @param options - Optional filters for scenarios and alert limit
 * @returns Markdown-formatted digest string
 *
 * @example
 * ```typescript
 * const digest = generateMonthlyDigest(trend, { scenarios: ['render', 'api'] });
 * console.log(digest);
 * ```
 */
export function generateMonthlyDigest(trend: PerformanceTrend, options?: DigestOptions): string {
  const scenarios = selectEntries(trend.entries, options?.scenarios);
  const latestByScenario = new Map<string, TrendEntry>();

  for (const entry of scenarios) {
    const current = latestByScenario.get(entry.scenario);
    if (!current || current.timestamp.localeCompare(entry.timestamp) < 0) {
      latestByScenario.set(entry.scenario, entry);
    }
  }

  const summaryLines: string[] = [
    `# Performance Digest (${new Date(trend.generatedAt).toISOString()})`,
    "",
    "## Summary",
  ];

  if (latestByScenario.size === 0) {
    summaryLines.push("No benchmark entries recorded for the selected scenarios.");
  } else {
    summaryLines.push(
      "Latest benchmark metrics by scenario:",
      "",
      "| Scenario | Metric | Value |",
      "| --- | --- | --- |"
    );

    for (const [scenario, entry] of [...latestByScenario.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      for (const [metric, value] of Object.entries(entry.metrics)) {
        summaryLines.push(`| ${scenario} | ${metric} | ${value} |`);
      }
    }
  }

  const sections: string[] = [...summaryLines];

  const alerts = trend.alerts.slice(0, options?.maxAlerts ?? trend.alerts.length);
  sections.push("", "## Regressions");
  if (alerts.length === 0) {
    sections.push("No regressions detected across recent benchmark runs.");
  } else {
    sections.push(
      "| Scenario | Metric | Change | Severity | Message |",
      "| --- | --- | --- | --- | --- |"
    );
    for (const alert of alerts) {
      const percent = (Math.abs(alert.changePercent) * 100).toFixed(2);
      sections.push(
        `| ${alert.scenario} | ${alert.metric} | ${percent}% (${alert.direction}) | ${alert.severity} | ${alert.message} |`
      );
    }
  }

  sections.push(
    "",
    "## Notes",
    "This digest is auto-generated from benchmark trend data. Review regressions promptly and update baselines when accepting intentional performance shifts."
  );

  return sections.join("\n");
}

/**
 * Converts a benchmark report into an array of trend entries.
 *
 * @param report - The benchmark report containing scenario results
 * @param scenarios - Optional filter to include only specific scenarios
 * @returns Array of trend entries derived from report results
 *
 * @example
 * ```typescript
 * const entries = createTrendEntriesFromReport(report, ['render']);
 * for (const entry of entries) {
 *   trend = updatePerformanceTrend(trend, entry);
 * }
 * ```
 */
export function createTrendEntriesFromReport(
  report: BenchmarkReport,
  scenarios?: string[]
): TrendEntry[] {
  const timestamp = report.generatedAt ?? new Date().toISOString();
  const scenarioFilter = scenarios?.map((name) => name.toLowerCase());

  return (report.results ?? [])
    .filter((result) => {
      if (!scenarioFilter || scenarioFilter.length === 0) {
        return true;
      }

      return scenarioFilter.includes(result.scenario.toLowerCase());
    })
    .map((result) => createTrendEntry(result, timestamp));
}
