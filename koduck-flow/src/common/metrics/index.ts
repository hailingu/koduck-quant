/**
 * @module src/common/metrics
 * @description Duck Flow metrics collection system - OpenTelemetry-based metrics with in-memory storage
 *
 * Provides a complete metrics collection framework with support for:
 * - Counters: monotonically increasing values
 * - Gauges: instantaneous point-in-time values
 * - Histograms: value distributions across buckets
 * - UpDownCounters: values that can increase/decrease
 * - Observable Gauges: callback-based computed values
 *
 * Features:
 * - Global provider management with lazy initialization
 * - Scoped meters with automatic attribute merging
 * - In-memory storage with series limits and TTL
 * - Prometheus text exposition format export
 * - Governance: sampling, series limits, attribute filtering
 *
 * @example
 * ```typescript
 * import {
 *   configureMetrics,
 *   setMetricsProvider,
 *   meter,
 *   InMemoryMetricsProvider
 * } from '@/common/metrics';
 *
 * // Initialize with in-memory provider
 * const provider = new InMemoryMetricsProvider();
 * setMetricsProvider(provider);
 *
 * // Configure governance
 * configureMetrics({
 *   governance: {
 *     seriesLimitPerMetric: 10000,
 *     samplingRate: 1.0
 *   },
 *   naming: {
 *     metricNamePrefix: 'myapp'
 *   }
 * });
 *
 * // Create meter and record metrics
 * const m = meter('myapp');
 * const counter = m.counter('requests_total');
 * counter.add(1, { method: 'GET', endpoint: '/api' });
 *
 * const histogram = m.histogram('request_duration_ms');
 * histogram.record(234, { endpoint: '/api' });
 *
 * // Export metrics
 * const snapshot = provider.snapshot();
 * const prometheusText = renderPrometheusExposition(snapshot);
 * ```
 */

// Core type definitions and interfaces
export * from "./types";
// No-operation provider (default, zero overhead)
export * from "./noop";
// In-memory provider with storage and aggregation
export * from "./in-memory";
// Global provider management and convenience functions
export * from "./global";
// Configuration and governance
export * from "./config";
// Scoped meter with automatic attribute merging
export * from "./scoped-meter";
// Prometheus format exporter
export * from "./exporter-prometheus";

// DX helpers (explicit re-exports for convenience)
export { setMetricsProvider, getMetricsProvider } from "./global";
