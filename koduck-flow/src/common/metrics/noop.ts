/**
 * @module src/common/metrics/noop
 * @description No-operation implementations of metrics interfaces
 * Provides lightweight dummy implementations that discard all measurements
 * Used as default provider during development or when metrics collection is disabled
 * @example
 * ```typescript
 * import { NoopMetricsProvider } from '@/common/metrics';
 *
 * // Metrics collection is completely disabled (zero overhead)
 * const provider = new NoopMetricsProvider();
 * const meter = provider.getMeter('app');
 * meter.counter('events').add(1000000); // Has no effect
 * ```
 */

import type {
  Attributes,
  Counter,
  Gauge,
  Histogram,
  Meter,
  MetricOptions,
  MetricsProvider,
  ObservableGauge,
  Observation,
  ProviderSnapshot,
  UpDownCounter,
} from "./types";

const consume = (...args: unknown[]): void => {
  if (args.length) {
    // intentionally empty — referencing length marks arguments as used
  }
};

/**
 * No-operation counter implementation
 * Discards all measurements with zero overhead
 * @class NoopCounter
 * @implements {Counter}
 * @internal
 */
class NoopCounter implements Counter {
  /**
   * Add a value (discarded)
   * @param {number} v - Value to add (ignored)
   * @param {Attributes} [a] - Attributes (ignored)
   */
  add(value: number, attributes?: Attributes): void {
    consume(value, attributes);
  }
}

/**
 * No-operation up/down counter implementation
 * @class NoopUpDownCounter
 * @implements {UpDownCounter}
 * @internal
 */
class NoopUpDownCounter implements UpDownCounter {
  /**
   * Add a delta (discarded)
   * @param {number} d - Delta to add (ignored)
   * @param {Attributes} [a] - Attributes (ignored)
   */
  add(delta: number, attributes?: Attributes): void {
    consume(delta, attributes);
  }
}

/**
 * No-operation gauge implementation
 * @class NoopGauge
 * @implements {Gauge}
 * @internal
 */
class NoopGauge implements Gauge {
  /**
   * Set gauge value (discarded)
   * @param {number} v - Value to set (ignored)
   * @param {Attributes} [a] - Attributes (ignored)
   */
  set(value: number, attributes?: Attributes): void {
    consume(value, attributes);
  }
}

/**
 * No-operation histogram implementation
 * @class NoopHistogram
 * @implements {Histogram}
 * @internal
 */
class NoopHistogram implements Histogram {
  /**
   * Record a value (discarded)
   * @param {number} v - Value to record (ignored)
   * @param {Attributes} [a] - Attributes (ignored)
   */
  record(value: number, attributes?: Attributes): void {
    consume(value, attributes);
  }
}

/**
 * No-operation observable gauge implementation
 * @class NoopObservableGauge
 * @implements {ObservableGauge}
 * @internal
 */
class NoopObservableGauge implements ObservableGauge {
  /**
   * Add callback (discarded)
   * @param {Function} callback - Callback to register (ignored)
   */
  addCallback(callback: (observe: (o: Observation) => void) => void): void {
    consume(callback);
  }

  /**
   * Remove callback (discarded)
   * @param {Function} callback - Callback to remove (ignored)
   */
  removeCallback(callback: (observe: (o: Observation) => void) => void): void {
    consume(callback);
  }
}

/**
 * No-operation meter implementation
 * Creates only noop instruments that discard all measurements
 * @class NoopMeter
 * @implements {Meter}
 * @internal
 */
class NoopMeter implements Meter {
  /**
   * Create a noop counter
   * @param {string} name - Metric name (ignored)
   * @param {MetricOptions} [options] - Options (ignored)
   * @returns {Counter} Noop counter
   */
  counter(name: string, options?: MetricOptions): Counter {
    consume(name, options);
    return new NoopCounter();
  }

  /**
   * Create a noop up/down counter
   * @param {string} name - Metric name (ignored)
   * @param {MetricOptions} [options] - Options (ignored)
   * @returns {UpDownCounter} Noop up/down counter
   */
  upDownCounter(name: string, options?: MetricOptions): UpDownCounter {
    consume(name, options);
    return new NoopUpDownCounter();
  }

  /**
   * Create a noop gauge
   * @param {string} name - Metric name (ignored)
   * @param {MetricOptions} [options] - Options (ignored)
   * @returns {Gauge} Noop gauge
   */
  gauge(name: string, options?: MetricOptions): Gauge {
    consume(name, options);
    return new NoopGauge();
  }

  /**
   * Create a noop histogram
   * @param {string} name - Metric name (ignored)
   * @param {MetricOptions} [options] - Options (ignored)
   * @returns {Histogram} Noop histogram
   */
  histogram(name: string, options?: MetricOptions): Histogram {
    consume(name, options);
    return new NoopHistogram();
  }

  /**
   * Create a noop observable gauge
   * @param {string} name - Metric name (ignored)
   * @param {MetricOptions} [options] - Options (ignored)
   * @returns {ObservableGauge} Noop observable gauge
   */
  observableGauge(name: string, options?: MetricOptions): ObservableGauge {
    consume(name, options);
    return new NoopObservableGauge();
  }

  /**
   * Measure time (returns function result without recording)
   * @template T
   * @param {string} name - Metric name (ignored)
   * @param {Function} fn - Function to execute
   * @param {Attributes} [attributes] - Attributes (ignored)
   * @returns {Promise<T>} Function result
   */
  async time<T>(name: string, fn: () => Promise<T> | T, attributes?: Attributes): Promise<T> {
    consume(name, attributes);
    return await fn();
  }

  /**
   * Collect metrics (discarded)
   */
  collect(): void {
    // No metrics to collect for noop meter
  }
}

/**
 * No-operation metrics provider implementation
 * Creates noop meters that discard all measurements with minimal overhead
 * Useful for disabling metrics during development or testing
 * @class NoopMetricsProvider
 * @implements {MetricsProvider}
 */
export class NoopMetricsProvider implements MetricsProvider {
  private readonly meter = new NoopMeter();

  /**
   * Get a noop meter for the scope
   * @param {string} scope - Scope name (ignored)
   * @returns {Meter} Noop meter instance
   */
  getMeter(scope: string): Meter {
    consume(scope);
    return this.meter;
  }

  /**
   * Collect metrics from noop instruments (no-op)
   */
  collect(): void {
    this.meter.collect?.();
  }

  /**
   * Snapshot noop metrics provider state (always empty)
   * @returns {ProviderSnapshot} Empty provider snapshot
   */
  snapshot(): ProviderSnapshot {
    return { meters: [] };
  }
}
