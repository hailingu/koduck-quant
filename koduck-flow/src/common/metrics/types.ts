/**
 * @module src/common/metrics/types
 * @description Core type definitions and contracts for the Duck Flow metrics collection system
 * Provides interfaces for meters, counters, gauges, histograms, and other metric instruments
 * based on OpenTelemetry standards with support for attributes, sampling, and snapshots
 * @example
 * ```typescript
 * import { Meter, Counter, Histogram } from '@/common/metrics';
 *
 * const meter: Meter = provider.getMeter('app');
 * const counter: Counter = meter.counter('requests_total');
 * counter.add(1, { method: 'GET', endpoint: '/api/data' });
 * ```
 */

/**
 * Collection of key-value attributes for metric measurements
 * Used to add dimensional data (labels) to metric points
 * @typedef {Object.<string, string | number | boolean>} Attributes
 * @example
 * ```typescript
 * const attributes = {
 *   method: 'POST',
 *   status: 200,
 *   cache_hit: true,
 *   duration_ms: 45.5
 * };
 * ```
 */
export type Attributes = Record<string, string | number | boolean>;

/**
 * Configuration options for metric creation
 * @interface MetricOptions
 * @property {string} [description] - Human-readable description of the metric
 * @property {string} [unit] - Unit of measurement (e.g., 'ms', 'count', 'bytes')
 * @property {number[]} [boundaries] - Histogram bucket boundaries (upper limits, excluding +Inf)
 */
export interface MetricOptions {
  description?: string | undefined;
  unit?: string | undefined;
  boundaries?: number[] | undefined;
}

/**
 * Counter metric instrument - measures additive monotonically increasing values
 * Typically used for tracking counts of events or operations
 * @interface Counter
 */
export interface Counter {
  /**
   * Add a value to the counter (must be >= 0)
   * @param {number} value - The amount to add
   * @param {Attributes} [attributes] - Optional dimensional attributes/labels
   */
  add(value: number, attributes?: Attributes): void;
}

/**
 * UpDownCounter metric instrument - measures additive values (positive or negative)
 * Used for metrics that can increase and decrease (e.g., active connections, queue size)
 * @interface UpDownCounter
 */
export interface UpDownCounter {
  /**
   * Add a delta (positive or negative) to the counter
   * @param {number} delta - The value to add/subtract
   * @param {Attributes} [attributes] - Optional dimensional attributes/labels
   */
  add(delta: number, attributes?: Attributes): void;
}

/**
 * Gauge metric instrument - measures instantaneous point-in-time values
 * Represents a snapshot of a value at collection time
 * @interface Gauge
 */
export interface Gauge {
  /**
   * Set the gauge to a specific value
   * @param {number} value - The value to set
   * @param {Attributes} [attributes] - Optional dimensional attributes/labels
   */
  set(value: number, attributes?: Attributes): void;
}

/**
 * Histogram metric instrument - measures distributions of values
 * Records measurements into buckets to observe value distribution
 * Implementation uses cumulative buckets and MUST include a +Inf bucket
 * @interface Histogram
 */
export interface Histogram {
  /**
   * Record a measurement into histogram buckets
   * Buckets array length = boundaries.length + 1 (last bucket is +Inf)
   * @param {number} value - The value to record
   * @param {Attributes} [attributes] - Optional dimensional attributes/labels
   */
  record(value: number, attributes?: Attributes): void;
}

/**
 * Single observation point for observable gauges
 * @interface Observation
 * @property {number} value - The observed value
 * @property {Attributes} [attributes] - Optional dimensional attributes/labels
 */
export interface Observation {
  value: number;
  attributes?: Attributes | undefined;
}

/**
 * Observable gauge metric instrument - measures on-demand computed values
 * Callbacks are invoked during collection to observe current values
 * @interface ObservableGauge
 */
export interface ObservableGauge {
  /**
   * Register a callback to compute and push observations
   * @param {Function} callback - Function invoked with observer during collection
   */
  addCallback(callback: (observe: (o: Observation) => void) => void): void;
  /**
   * Unregister a previously registered callback
   * @param {Function} callback - The callback to remove
   */
  removeCallback(callback: (observe: (o: Observation) => void) => void): void;
}

/**
 * Meter interface - factory for creating metric instruments
 * Represents a logical grouping of metrics within a scope
 * @interface Meter
 */
export interface Meter {
  /**
   * Create a counter metric
   * @param {string} name - Unique metric name
   * @param {MetricOptions} [options] - Configuration including description and unit
   * @returns {Counter} Counter instance for recording measurements
   */
  counter(name: string, options?: MetricOptions): Counter;
  /**
   * Create an up/down counter metric
   * @param {string} name - Unique metric name
   * @param {MetricOptions} [options] - Configuration options
   * @returns {UpDownCounter} UpDownCounter instance
   */
  upDownCounter(name: string, options?: MetricOptions): UpDownCounter;
  /**
   * Create a gauge metric
   * @param {string} name - Unique metric name
   * @param {MetricOptions} [options] - Configuration options
   * @returns {Gauge} Gauge instance
   */
  gauge(name: string, options?: MetricOptions): Gauge;
  /**
   * Create a histogram metric
   * @param {string} name - Unique metric name
   * @param {MetricOptions} [options] - Configuration with bucket boundaries
   * @returns {Histogram} Histogram instance
   */
  histogram(name: string, options?: MetricOptions): Histogram;
  /**
   * Create an observable gauge metric
   * @param {string} name - Unique metric name
   * @param {MetricOptions} [options] - Configuration options
   * @returns {ObservableGauge} ObservableGauge instance
   */
  observableGauge(name: string, options?: MetricOptions): ObservableGauge;
  /**
   * Helper method to measure execution time of a function
   * @template T
   * @param {string} name - Metric name for the duration histogram
   * @param {Function} fn - Function to measure (sync or async)
   * @param {Attributes} [attributes] - Optional attributes for the measurement
   * @returns {Promise<T>} The function's return value or promise result
   */
  time<T>(name: string, fn: () => Promise<T> | T, attributes?: Attributes): Promise<T>;

  /**
   * Trigger on-demand collection and aggregation of metrics
   * Optional implementation for collecting observable instruments
   * @returns {void|Promise<void>}
   */
  collect?(): void | Promise<void>;
}

/**
 * MetricsProvider interface - root provider for metrics collection
 * Manages meter instances and lifecycle for metric collection
 * @interface MetricsProvider
 */
export interface MetricsProvider {
  /**
   * Get or create a meter for a specific scope
   * @param {string} scope - Logical scope/component name
   * @returns {Meter} Meter instance for this scope
   */
  getMeter(scope: string): Meter;
  /**
   * Shutdown the provider and cleanup resources
   * @returns {void|Promise<void>}
   */
  shutdown?(): void | Promise<void>;
  /**
   * Trigger collection of all metrics
   * @returns {void|Promise<void>}
   */
  collect?(): void | Promise<void>;
  /**
   * Create a snapshot of all collected metrics for export
   * @returns {ProviderSnapshot} Snapshot of all meters and metrics
   */
  snapshot?(): ProviderSnapshot;
}

/**
 * Canonical attributes key - serialized and sorted representation of attributes
 * Used internally for consistent keying of metric series
 * Example: 'endpoint=/api|method=GET'
 * @typedef {string} AttributeKey
 */
export type AttributeKey = string;

/**
 * Point data for a counter metric
 * @interface CounterPoint
 * @property {number} value - The cumulative counter value
 */
export interface CounterPoint {
  value: number;
}

/**
 * Point data for an up/down counter metric
 * @interface UpDownCounterPoint
 * @property {number} value - The current counter value (can be negative)
 */
export interface UpDownCounterPoint {
  value: number;
}

/**
 * Point data for a gauge metric
 * @interface GaugePoint
 * @property {number} value - The gauge value at collection time
 */
export interface GaugePoint {
  value: number;
}

/**
 * Point data for a histogram metric
 * Represents distribution of recorded values across configured buckets
 * @interface HistogramPoint
 * @property {number} count - Total number of recorded values
 * @property {number} sum - Sum of all recorded values
 * @property {number[]} buckets - Cumulative counts per bucket (length = boundaries.length + 1)
 * @property {number[]} boundaries - Finite upper bounds of buckets, excluding +Inf
 */
export interface HistogramPoint {
  count: number;
  sum: number;
  buckets: number[];
  boundaries: number[];
}

/**
 * Generic metric data container for a specific metric instrument
 * Contains name, description, and point data per unique attribute combination
 * @template TPoint - Type of point data (Counter, Gauge, Histogram, etc.)
 * @interface MetricData
 * @property {string} name - Metric instrument name
 * @property {string} [description] - Human-readable metric description
 * @property {string} [unit] - Unit of measurement
 * @property {Object.<AttributeKey, TPoint>} points - Map of attribute combinations to point values
 */
export interface MetricData<TPoint> {
  name: string;
  description?: string | undefined;
  unit?: string | undefined;
  points: Record<AttributeKey, TPoint>;
}

/**
 * Snapshot of all metrics from a single meter
 * Contains collections of all metric types aggregated by scope
 * @interface MeterSnapshot
 * @property {string} scope - The scope/component this meter represents
 * @property {MetricData<CounterPoint>[]} counters - All counter metrics
 * @property {MetricData<UpDownCounterPoint>[]} upDownCounters - All up/down counter metrics
 * @property {MetricData<GaugePoint>[]} gauges - All gauge metrics
 * @property {MetricData<HistogramPoint>[]} histograms - All histogram metrics
 */
export interface MeterSnapshot {
  scope: string;
  counters: MetricData<CounterPoint>[];
  upDownCounters: MetricData<UpDownCounterPoint>[];
  gauges: MetricData<GaugePoint>[];
  histograms: MetricData<HistogramPoint>[];
}

/**
 * Complete snapshot of all metrics from the provider
 * Used by exporters to render metrics in various formats
 * @interface ProviderSnapshot
 * @property {MeterSnapshot[]} meters - All meter snapshots organized by scope
 */
export interface ProviderSnapshot {
  meters: MeterSnapshot[];
}

/**
 * Interface for metrics exporters
 * Implementations render provider snapshots in specific formats
 * @interface MetricsExporter
 */
export interface MetricsExporter {
  /**
   * Render metrics snapshot in exporter-specific format
   * @param {ProviderSnapshot} snapshot - Metrics snapshot from provider
   * @returns {string|Promise<string>} Formatted metrics output
   */
  render(snapshot: ProviderSnapshot): string | Promise<string>;
}
