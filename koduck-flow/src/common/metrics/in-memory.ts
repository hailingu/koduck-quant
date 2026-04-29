/**
 * @module src/common/metrics/in-memory
 * @description In-memory metrics provider with full OpenTelemetry support
 *
 * Provides complete in-memory storage and aggregation for all metric types:
 * - Counters and UpDownCounters with LRU eviction
 * - Gauges with series limits and TTL
 * - Histograms with configurable buckets
 * - Observable Gauges with callback-based collection
 *
 * Features:
 * - Series cardinality governance (limits and TTL)
 * - Sampling support for write-time filtering
 * - Attribute filtering (whitelist/blacklist)
 * - Cumulative histogram buckets (OpenMetrics compliant)
 * - Snapshot generation for export
 *
 * @example
 * ```typescript
 * import { InMemoryMetricsProvider, setMetricsProvider } from '@/common/metrics';
 *
 * const provider = new InMemoryMetricsProvider();
 * setMetricsProvider(provider);
 *
 * const meter = provider.getMeter('myapp');
 * meter.counter('requests').add(1);
 *
 * const snapshot = provider.snapshot();
 * ```
 */

import type {
  Attributes,
  Counter,
  Gauge,
  Histogram,
  Meter,
  MetricData,
  MetricOptions,
  MetricsProvider,
  ObservableGauge,
  Observation,
  UpDownCounter,
  CounterPoint,
  GaugePoint,
  UpDownCounterPoint,
  HistogramPoint,
  MeterSnapshot,
  ProviderSnapshot,
} from "./types";
import { filterAttributes, getMetricsConfig, shouldSample } from "./config";

// Default histogram bucket boundaries (OpenMetrics standard)
const DEFAULT_BOUNDARIES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

/**
 * Canonicalize attributes into a consistent string key
 * Sorts keys and formats as 'k1=v1|k2=v2'
 * Used for consistent series identification across measurements
 * @param {Attributes} [attrs] - Attributes to canonicalize
 * @returns {string} Canonical key representation (empty string if no attributes)
 * @internal
 */
function canonicalizeAttributes(attrs?: Attributes): string {
  const a = filterAttributes(attrs);
  if (!a) return "";
  const entries = Object.entries(a).map(([k, v]) => [k, String(v)] as const);
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return entries.map(([k, v]) => `${k}=${v}`).join("|");
}

/**
 * Get current timestamp in milliseconds
 * Uses performance.now() if available (higher resolution), falls back to Date.now()
 * @returns {number} Current time in milliseconds
 * @internal
 */
function nowMs(): number {
  const g: unknown = typeof globalThis !== "undefined" ? globalThis : undefined;
  // minimal runtime check without relying on TS types
  if (g && typeof (g as { performance?: { now?: unknown } }).performance?.now === "function") {
    return (g as { performance: { now: () => number } }).performance.now();
  }
  return Date.now();
}

/**
 * Prune series that have exceeded their TTL
 * Called during collection to clean up inactive series
 * @param {Map<string, number>} touched - Map of series key to last update timestamp
 * @param {Function} deleteKey - Callback to delete series by key
 * @internal
 */
function pruneExpiredSeries(touched: Map<string, number>, deleteKey: (key: string) => void): void {
  const ttl = getMetricsConfig().governance?.seriesTTLms;
  if (!ttl || ttl <= 0) return;
  const now = Date.now();
  for (const [key, ts] of touched.entries()) {
    if (now - ts > ttl) {
      touched.delete(key);
      deleteKey(key);
    }
  }
}

/**
 * In-memory counter implementation
 * Stores cumulative values per attribute series with cardinality governance
 * @class InMemoryCounter
 * @implements {Counter}
 * @internal
 */
class InMemoryCounter implements Counter {
  private readonly data: Map<string, number>;
  private readonly touched: Map<string, number>;

  /**
   * Create counter with data storage
   * @param {Map<string, number>} data - Storage map for counter values
   * @param {Map<string, number>} touched - Last update timestamp map for TTL
   */
  constructor(data: Map<string, number>, touched: Map<string, number>) {
    this.data = data;
    this.touched = touched;
  }

  /**
   * Add a value to the counter
   * @param {number} value - Amount to add
   * @param {Attributes} [attributes] - Dimensional attributes
   */
  add(value: number, attributes?: Attributes): void {
    if (!shouldSample()) return;
    pruneExpiredSeries(this.touched, (k) => this.data.delete(k));
    const key = canonicalizeAttributes(attributes);
    const limit = getMetricsConfig().governance?.seriesLimitPerMetric;

    // Cardinality governance: Enforce series limit per metric
    // Algorithm: LRU (Least Recently Used) eviction when limit exceeded
    // Rationale: Unbounded cardinality (e.g., user_id dimension) can cause memory explosion
    // Solution: When adding new series would exceed limit, remove least recently used series
    // Time complexity: O(n) scan for LRU, but n = series_limit (typically 10-100) so acceptable
    if (limit !== undefined && !this.data.has(key) && this.data.size >= limit) {
      // Step 1: Find the least recently used (oldest) series
      // We iterate through touched map to find the series with minimum timestamp
      let lruKey: string | undefined;
      let lruTs = Infinity;
      for (const [k, ts] of this.touched.entries()) {
        if (ts < lruTs) {
          lruTs = ts;
          lruKey = k;
        }
      }

      // Step 2: Remove the LRU series if found
      // This makes room for the new series
      if (lruKey) {
        this.touched.delete(lruKey);
        this.data.delete(lruKey);
      } else {
        // No series to evict (shouldn't happen), give up adding new series
        return;
      }
    }

    // Step 3: Record the value
    // Use 0 as default if key doesn't exist yet, then add the value
    const prev = this.data.get(key) ?? 0;
    this.data.set(key, prev + value);
    this.touched.set(key, Date.now());
  }
}

/**
 * In-memory up/down counter implementation
 * Like counter but allows negative deltas
 * @class InMemoryUpDownCounter
 * @implements {UpDownCounter}
 * @internal
 */
class InMemoryUpDownCounter implements UpDownCounter {
  private readonly data: Map<string, number>;
  private readonly touched: Map<string, number>;

  constructor(data: Map<string, number>, touched: Map<string, number>) {
    this.data = data;
    this.touched = touched;
  }

  /**
   * Add a delta (positive or negative) to counter
   * @param {number} delta - Amount to add/subtract
   * @param {Attributes} [attributes] - Dimensional attributes
   */
  add(delta: number, attributes?: Attributes): void {
    if (!shouldSample()) return;
    pruneExpiredSeries(this.touched, (k) => this.data.delete(k));
    const key = canonicalizeAttributes(attributes);
    const limit = getMetricsConfig().governance?.seriesLimitPerMetric;
    if (limit !== undefined && !this.data.has(key) && this.data.size >= limit) {
      let lruKey: string | undefined;
      let lruTs = Infinity;
      for (const [k, ts] of this.touched.entries()) {
        if (ts < lruTs) {
          lruTs = ts;
          lruKey = k;
        }
      }
      if (lruKey) {
        this.touched.delete(lruKey);
        this.data.delete(lruKey);
      } else {
        return;
      }
    }
    const prev = this.data.get(key) ?? 0;
    this.data.set(key, prev + delta);
    this.touched.set(key, Date.now());
  }
}

/**
 * In-memory gauge implementation
 * Stores point-in-time values
 * @class InMemoryGauge
 * @implements {Gauge}
 * @internal
 */
class InMemoryGauge implements Gauge {
  private readonly data: Map<string, number>;
  private readonly touched: Map<string, number>;

  constructor(data: Map<string, number>, touched: Map<string, number>) {
    this.data = data;
    this.touched = touched;
  }

  /**
   * Set gauge to a value
   * @param {number} value - Value to set
   * @param {Attributes} [attributes] - Dimensional attributes
   */
  set(value: number, attributes?: Attributes): void {
    if (!shouldSample()) return;
    pruneExpiredSeries(this.touched, (k) => this.data.delete(k));
    const key = canonicalizeAttributes(attributes);
    const limit = getMetricsConfig().governance?.seriesLimitPerMetric;
    if (limit !== undefined && !this.data.has(key) && this.data.size >= limit) {
      let lruKey: string | undefined;
      let lruTs = Infinity;
      for (const [k, ts] of this.touched.entries()) {
        if (ts < lruTs) {
          lruTs = ts;
          lruKey = k;
        }
      }
      if (lruKey) {
        this.touched.delete(lruKey);
        this.data.delete(lruKey);
      } else {
        return;
      }
    }
    this.data.set(key, value);
    this.touched.set(key, Date.now());
  }
}

/**
 * In-memory histogram implementation
 * Records values into cumulative buckets with configurable boundaries
 * @class InMemoryHistogram
 * @implements {Histogram}
 * @internal
 */
class InMemoryHistogram implements Histogram {
  private readonly boundaries: number[];
  private readonly buckets: Map<string, number[]> = new Map();
  private readonly sums: Map<string, number> = new Map();
  private readonly counts: Map<string, number> = new Map();
  private readonly touched: Map<string, number> = new Map();

  /**
   * Create histogram with bucket boundaries
   * @param {number[]} [boundaries] - Bucket upper bounds, uses DEFAULT_BOUNDARIES if not provided
   */
  constructor(boundaries?: number[]) {
    this.boundaries = (boundaries?.length ? [...boundaries] : DEFAULT_BOUNDARIES).sort(
      (a, b) => a - b
    );
  }

  /**
   * Record a value into histogram buckets
   * Updates cumulative counts, sum, and count metrics
   * @param {number} value - Value to record
   * @param {Attributes} [attributes] - Dimensional attributes
   */
  record(value: number, attributes?: Attributes): void {
    if (!shouldSample()) return;
    pruneExpiredSeries(this.touched, (k) => {
      this.buckets.delete(k);
      this.sums.delete(k);
      this.counts.delete(k);
    });
    const key = canonicalizeAttributes(attributes);
    const limit = getMetricsConfig().governance?.seriesLimitPerMetric;
    if (limit !== undefined && !this.buckets.has(key) && this.buckets.size >= limit) {
      // evict LRU
      let lruKey: string | undefined;
      let lruTs = Infinity;
      for (const [k, ts] of this.touched.entries()) {
        if (ts < lruTs) {
          lruTs = ts;
          lruKey = k;
        }
      }
      if (lruKey) {
        this.touched.delete(lruKey);
        this.buckets.delete(lruKey);
        this.sums.delete(lruKey);
        this.counts.delete(lruKey);
      } else {
        return;
      }
    }

    let b = this.buckets.get(key);
    if (!b) {
      // Initialize bucket array with length = boundaries.length + 1
      // Extra bucket for +Infinity (values exceeding all boundaries)
      // Example: boundaries = [1, 5, 10] → buckets array length = 4
      // buckets[0] = count where value <= 1
      // buckets[1] = count where value <= 5
      // buckets[2] = count where value <= 10
      // buckets[3] = count where value > 10 (infinity bucket)
      b = new Array(this.boundaries.length + 1).fill(0);
      this.buckets.set(key, b);
      this.sums.set(key, 0);
      this.counts.set(key, 0);
    }

    // Step 1: Find the target bucket index for this value
    // Algorithm: Locate the first boundary greater than value
    // Example: If boundaries = [1, 5, 10] and value = 7:
    //   - 7 <= 1? No
    //   - 7 <= 5? No
    //   - 7 <= 10? Yes → idx = 2
    // If value > all boundaries, idx = -1 (assign to +Infinity bucket)
    const idx = this.boundaries.findIndex((ub) => value <= ub);
    const target = idx === -1 ? this.boundaries.length /* +Inf */ : idx;

    // Step 2: Update cumulative bucket counts
    // Key insight: OpenMetrics histograms use cumulative buckets
    // When value fits in bucket N, we increment buckets N, N+1, ..., end
    // This maintains the property: buckets[i] >= buckets[i+1]
    // Example: If target = 1 and buckets = [3, 2, 0, 0]:
    //   After: buckets = [3, 3, 1, 1] (incremented all buckets >= 1)
    for (let i = target; i < b.length; i++) {
      // keep cumulative counts: increment all buckets >= idx
      b[i] += 1;
    }

    // Step 3: Update aggregate statistics
    // Track total count and sum for mean calculation
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    this.sums.set(key, (this.sums.get(key) ?? 0) + value);
    this.touched.set(key, Date.now());
  }

  /**
   * Export histogram as point data for snapshot
   * @returns {Object} Points data with boundaries
   * @internal
   */
  toPoints(): { points: Record<string, HistogramPoint>; boundaries: number[] } {
    const points: Record<string, HistogramPoint> = {};
    for (const [key, b] of this.buckets.entries()) {
      points[key] = {
        buckets: b.slice(),
        boundaries: this.boundaries.slice(),
        count: this.counts.get(key) ?? 0,
        sum: this.sums.get(key) ?? 0,
      };
    }
    return { points, boundaries: this.boundaries.slice() };
  }

  /**
   * Prune expired series based on TTL
   * @param {number} now - Current timestamp
   * @param {number} ttl - Time-to-live in milliseconds
   * @internal
   */
  pruneTTL(now: number, ttl: number): void {
    for (const [key, ts] of this.touched.entries()) {
      if (now - ts > ttl) {
        this.touched.delete(key);
        this.buckets.delete(key);
        this.sums.delete(key);
        this.counts.delete(key);
      }
    }
  }
}

/**
 * In-memory meter implementation
 * Manages multiple metric instruments and provides collection/snapshot functionality
 * @class InMemoryMeter
 * @implements {Meter}
 * @internal
 */
class InMemoryMeter implements Meter {
  private readonly counters = new Map<
    string,
    {
      options?: MetricOptions | undefined;
      data: Map<string, number>;
      touched: Map<string, number>;
    }
  >();
  private readonly upDownCounters = new Map<
    string,
    {
      options?: MetricOptions | undefined;
      data: Map<string, number>;
      touched: Map<string, number>;
    }
  >();
  private readonly gauges = new Map<
    string,
    {
      options?: MetricOptions | undefined;
      data: Map<string, number>;
      touched: Map<string, number>;
    }
  >();
  private readonly histograms = new Map<
    string,
    { options?: MetricOptions | undefined; impl: InMemoryHistogram }
  >();
  private readonly observableGauges = new Map<
    string,
    {
      options?: MetricOptions | undefined;
      callbacks: Set<(observe: (o: Observation) => void) => void>;
      observations: Map<string, number>;
    }
  >();

  public readonly scope: string;

  /**
   * Create meter for a scope
   * @param {string} scope - Scope/component name
   */
  constructor(scope: string) {
    this.scope = scope;
  }

  /**
   * Get or create counter metric
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Configuration
   * @returns {Counter} Counter instance
   */
  counter(name: string, options?: MetricOptions): Counter {
    let entry = this.counters.get(name);
    if (!entry) {
      entry = { options, data: new Map(), touched: new Map() };
      this.counters.set(name, entry);
    }
    return new InMemoryCounter(entry.data, entry.touched);
  }

  /**
   * Get or create up/down counter metric
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Configuration
   * @returns {UpDownCounter} UpDownCounter instance
   */
  upDownCounter(name: string, options?: MetricOptions): UpDownCounter {
    let entry = this.upDownCounters.get(name);
    if (!entry) {
      entry = { options, data: new Map(), touched: new Map() };
      this.upDownCounters.set(name, entry);
    }
    return new InMemoryUpDownCounter(entry.data, entry.touched);
  }

  /**
   * Get or create gauge metric
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Configuration
   * @returns {Gauge} Gauge instance
   */
  gauge(name: string, options?: MetricOptions): Gauge {
    let entry = this.gauges.get(name);
    if (!entry) {
      entry = { options, data: new Map(), touched: new Map() };
      this.gauges.set(name, entry);
    }
    return new InMemoryGauge(entry.data, entry.touched);
  }

  /**
   * Get or create histogram metric
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Configuration with bucket boundaries
   * @returns {Histogram} Histogram instance
   */
  histogram(name: string, options?: MetricOptions): Histogram {
    let entry = this.histograms.get(name);
    if (!entry) {
      entry = { options, impl: new InMemoryHistogram(options?.boundaries) };
      this.histograms.set(name, entry);
    }
    return entry.impl;
  }

  /**
   * Get or create observable gauge metric
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Configuration
   * @returns {ObservableGauge} ObservableGauge instance
   */
  observableGauge(name: string, options?: MetricOptions): ObservableGauge {
    let entry = this.observableGauges.get(name);
    if (!entry) {
      entry = { options, callbacks: new Set(), observations: new Map() };
      this.observableGauges.set(name, entry);
    }
    const impl: ObservableGauge = {
      addCallback: (cb: (observe: (o: Observation) => void) => void) => {
        entry.callbacks.add(cb);
      },
      removeCallback: (cb: (observe: (o: Observation) => void) => void) => {
        entry.callbacks.delete(cb);
      },
    };
    return impl;
  }

  /**
   * Measure function execution time and record to histogram
   * @template T
   * @param {string} name - Histogram name for duration recording
   * @param {Function} fn - Function to measure
   * @param {Attributes} [attributes] - Attributes for the measurement
   * @returns {Promise<T>} Function result
   */
  async time<T>(name: string, fn: () => Promise<T> | T, attributes?: Attributes): Promise<T> {
    const start = nowMs();
    try {
      const res = await fn();
      return res;
    } finally {
      const ms = nowMs() - start;
      this.histogram(name, { unit: "ms" }).record(ms, attributes);
    }
  }

  /**
   * Collect metrics and prepare for snapshot
   * Evaluates observable gauge callbacks and prunes expired series by TTL
   */
  collect(): void {
    // Evaluate observable gauges
    for (const [, entry] of this.observableGauges.entries()) {
      entry.observations.clear();
      const observe = (o: Observation) => {
        const key = canonicalizeAttributes(o.attributes);
        entry.observations.set(key, o.value);
      };
      for (const cb of entry.callbacks) {
        try {
          cb(observe);
        } catch {
          /* ignore */
        }
      }
    }
    // TTL prune for counters/updowns/gauges and histograms
    const ttl = getMetricsConfig().governance?.seriesTTLms;
    if (ttl && ttl > 0) {
      const now = Date.now();
      for (const e of this.counters.values()) {
        for (const [key, ts] of e.touched.entries()) {
          if (now - ts > ttl) {
            e.touched.delete(key);
            e.data.delete(key);
          }
        }
      }
      for (const e of this.upDownCounters.values()) {
        for (const [key, ts] of e.touched.entries()) {
          if (now - ts > ttl) {
            e.touched.delete(key);
            e.data.delete(key);
          }
        }
      }
      for (const e of this.gauges.values()) {
        for (const [key, ts] of e.touched.entries()) {
          if (now - ts > ttl) {
            e.touched.delete(key);
            e.data.delete(key);
          }
        }
      }
      for (const e of this.histograms.values()) {
        e.impl.pruneTTL(now, ttl);
      }
    }
  }

  /**
   * Create snapshot of all metrics for export
   * Merges observable gauge observations into gauge snapshot
   * @returns {MeterSnapshot} Complete snapshot of this meter's metrics
   */
  snapshot(): MeterSnapshot {
    const counters: MetricData<CounterPoint>[] = [];
    const upDownCounters: MetricData<UpDownCounterPoint>[] = [];
    const gauges: MetricData<GaugePoint>[] = [];
    const histograms: MetricData<HistogramPoint>[] = [];

    for (const [name, { options, data }] of this.counters.entries()) {
      const points: Record<string, CounterPoint> = {};
      for (const [k, v] of data.entries()) points[k] = { value: v };
      counters.push({
        name,
        description: options?.description,
        unit: options?.unit,
        points,
      });
    }

    for (const [name, { options, data }] of this.upDownCounters.entries()) {
      const points: Record<string, UpDownCounterPoint> = {};
      for (const [k, v] of data.entries()) points[k] = { value: v };
      upDownCounters.push({
        name,
        description: options?.description,
        unit: options?.unit,
        points,
      });
    }

    for (const [name, { options, data }] of this.gauges.entries()) {
      const points: Record<string, GaugePoint> = {};
      for (const [k, v] of data.entries()) points[k] = { value: v };
      gauges.push({
        name,
        description: options?.description,
        unit: options?.unit,
        points,
      });
    }

    for (const [name, { options, impl }] of this.histograms.entries()) {
      const { points } = impl.toPoints();
      histograms.push({
        name,
        description: options?.description,
        unit: options?.unit,
        points,
      });
    }

    // Merge observable gauge observations into gauges snapshot
    for (const [name, { options, observations }] of this.observableGauges.entries()) {
      const existingIdx = gauges.findIndex((g) => g.name === name);
      if (existingIdx >= 0) {
        const points = gauges[existingIdx].points;
        for (const [k, v] of observations.entries()) points[k] = { value: v };
      } else {
        const points: Record<string, GaugePoint> = {};
        for (const [k, v] of observations.entries()) points[k] = { value: v };
        gauges.push({
          name,
          description: options?.description,
          unit: options?.unit,
          points,
        });
      }
    }

    return {
      scope: this.scope,
      counters,
      upDownCounters,
      gauges,
      histograms,
    };
  }
}

/**
 * In-memory metrics provider implementation
 * Stores all metrics in memory with full OpenTelemetry support
 * Suitable for development and testing; may require periodic exports for production
 * @class InMemoryMetricsProvider
 * @implements {MetricsProvider}
 * @example
 * ```typescript
 * const provider = new InMemoryMetricsProvider();
 * setMetricsProvider(provider);
 *
 * const meter = provider.getMeter('app');
 * meter.counter('requests').add(1);
 *
 * const snapshot = provider.snapshot();
 * const prometheus = renderPrometheusExposition(snapshot);
 * ```
 */
export class InMemoryMetricsProvider implements MetricsProvider {
  private readonly meters = new Map<string, InMemoryMeter>();

  /**
   * Get or create a meter for a scope
   * @param {string} scope - Scope/component name
   * @returns {Meter} Meter for this scope
   */
  getMeter(scope: string): Meter {
    let m = this.meters.get(scope);
    if (!m) {
      m = new InMemoryMeter(scope);
      this.meters.set(scope, m);
    }
    return m;
  }

  /**
   * Get snapshot of all meters and metrics
   * Automatically calls collect() on all meters first
   * @returns {ProviderSnapshot} Complete snapshot of all meters
   */
  snapshot(): ProviderSnapshot {
    return {
      meters: Array.from(this.meters.values()).map((m) => m.snapshot()),
    };
  }

  /**
   * Trigger collection on all meters
   * Evaluates observable gauges and prunes expired series
   */
  collect(): void {
    for (const m of this.meters.values()) m.collect();
  }
}
