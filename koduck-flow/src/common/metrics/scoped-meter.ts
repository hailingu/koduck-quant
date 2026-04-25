/**
 * @module src/common/metrics/scoped-meter
 * @description Scoped meter wrapper for automatic attribute merging
 * Provides a meter implementation that automatically merges base attributes with measurement-specific attributes
 * Useful for adding context-specific dimensions to all metrics in a scope
 * @example
 * ```typescript
 * import { ScopedMeter } from '@/common/metrics';
 *
 * const baseMeter = provider.getMeter('app');
 * const scopedMeter = new ScopedMeter(baseMeter, { service: 'api' });
 *
 * // Automatically adds service='api' to all measurements
 * scopedMeter.counter('requests').add(1, { method: 'GET' });
 * // Results in attributes: { service: 'api', method: 'GET' }
 * ```
 */

import type {
  Attributes,
  Counter,
  Gauge,
  Histogram,
  Meter,
  MetricOptions,
  ObservableGauge,
  Observation,
  UpDownCounter,
} from "./types";

/**
 * Merge base attributes with additional attributes
 * Additional attributes override base attributes on conflicts
 * @param {Attributes} [base] - Base attributes
 * @param {Attributes} [extra] - Additional attributes to merge
 * @returns {Attributes|undefined} Merged attributes or undefined if both inputs are undefined
 * @internal
 */
function mergeAttrs(base?: Attributes, extra?: Attributes): Attributes | undefined {
  if (!base) return extra ? { ...extra } : undefined;
  if (!extra) return base ? { ...base } : undefined;
  return { ...base, ...extra };
}

/**
 * Scoped meter implementation with automatic base attribute merging
 * Wraps another meter and prepends base attributes to all measurements
 * @class ScopedMeter
 * @implements {Meter}
 */
export class ScopedMeter implements Meter {
  private readonly inner: Meter;
  private readonly baseAttrs: Attributes | undefined;

  /**
   * Create a scoped meter with base attributes
   * @param {Meter} inner - The underlying meter to wrap
   * @param {Attributes} [baseAttrs] - Base attributes to prepend to all measurements
   */
  constructor(inner: Meter, baseAttrs: Attributes | undefined = undefined) {
    this.inner = inner;
    this.baseAttrs = baseAttrs;
  }

  /**
   * Create a counter with automatic attribute merging
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Metric configuration
   * @returns {Counter} Counter that merges base attributes
   */
  counter(name: string, options?: MetricOptions): Counter {
    const c = this.inner.counter(name, options);
    return {
      add: (v: number, a?: Attributes) => c.add(v, mergeAttrs(this.baseAttrs, a)),
    };
  }

  /**
   * Create an up/down counter with automatic attribute merging
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Metric configuration
   * @returns {UpDownCounter} UpDownCounter that merges base attributes
   */
  upDownCounter(name: string, options?: MetricOptions): UpDownCounter {
    const c = this.inner.upDownCounter(name, options);
    return {
      add: (d: number, a?: Attributes) => c.add(d, mergeAttrs(this.baseAttrs, a)),
    };
  }

  /**
   * Create a gauge with automatic attribute merging
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Metric configuration
   * @returns {Gauge} Gauge that merges base attributes
   */
  gauge(name: string, options?: MetricOptions): Gauge {
    const g = this.inner.gauge(name, options);
    return {
      set: (v: number, a?: Attributes) => g.set(v, mergeAttrs(this.baseAttrs, a)),
    };
  }

  /**
   * Create a histogram with automatic attribute merging
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Metric configuration
   * @returns {Histogram} Histogram that merges base attributes
   */
  histogram(name: string, options?: MetricOptions): Histogram {
    const h = this.inner.histogram(name, options);
    return {
      record: (v: number, a?: Attributes) => h.record(v, mergeAttrs(this.baseAttrs, a)),
    };
  }

  /**
   * Create an observable gauge with automatic attribute merging
   * Wraps callbacks to merge base attributes with observed values
   * @param {string} name - Metric name
   * @param {MetricOptions} [options] - Metric configuration
   * @returns {ObservableGauge} ObservableGauge that merges base attributes
   */
  observableGauge(name: string, options?: MetricOptions): ObservableGauge {
    const og = this.inner.observableGauge(name, options);
    // Map original callbacks to wrapped callbacks so remove works correctly
    const map = new Map<
      (observe: (o: Observation) => void) => void,
      (observe: (o: Observation) => void) => void
    >();
    const wrapped: ObservableGauge = {
      addCallback: (cb) => {
        const wc = (observe: (o: Observation) => void) =>
          cb((o) =>
            observe({
              value: o.value,
              attributes: mergeAttrs(this.baseAttrs, o.attributes),
            })
          );
        map.set(cb, wc);
        og.addCallback(wc);
      },
      removeCallback: (cb) => {
        const wc = map.get(cb);
        if (wc) {
          og.removeCallback(wc);
          map.delete(cb);
        }
      },
    };
    return wrapped;
  }

  /**
   * Measure time with automatic attribute merging
   * @template T
   * @param {string} name - Metric name
   * @param {Function} fn - Function to measure
   * @param {Attributes} [attributes] - Measurement-specific attributes
   * @returns {Promise<T>} Function result
   */
  async time<T>(name: string, fn: () => Promise<T> | T, attributes?: Attributes): Promise<T> {
    return this.inner.time(name, fn, mergeAttrs(this.baseAttrs, attributes));
  }

  /**
   * Collect metrics (delegates to inner meter)
   * @returns {void|Promise<void>} Result from inner meter's collect
   */
  collect(): void | Promise<void> {
    return this.inner.collect?.();
  }

  /**
   * Create a new scoped meter with additional base attributes
   * Merges the new attributes with existing base attributes
   * @param {Attributes} attrs - Additional attributes to add
   * @returns {ScopedMeter} New scoped meter with merged base attributes
   * @example
   * ```typescript
   * const base = new ScopedMeter(meter, { app: 'myapp' });
   * const service = base.withAttributes({ service: 'api' });
   * // Results in { app: 'myapp', service: 'api' }
   * ```
   */
  withAttributes(attrs: Attributes): ScopedMeter {
    const merged = mergeAttrs(this.baseAttrs, attrs);
    return new ScopedMeter(this.inner, merged);
  }
}
