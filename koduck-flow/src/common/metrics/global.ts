/**
 * @module src/common/metrics/global
 * @description Global metrics registry and provider management
 * Provides singleton access to metrics provider and meters throughout the application
 * @example
 * ```typescript
 * import { meter, setMetricsProvider, GlobalMetrics } from '@/common/metrics';
 *
 * const m = meter('myapp');
 * const counter = m.counter('events_total');
 * counter.add(1);
 * ```
 */

import type { Meter, MetricsProvider } from "./types";
import { NoopMetricsProvider } from "./noop";

/**
 * Global metrics registry - manages provider instance and provides access to meters
 * Uses lazy initialization with NoopMetricsProvider as default
 * @class GlobalMetricsRegistry
 * @internal
 */
class GlobalMetricsRegistry {
  private provider: MetricsProvider;

  /**
   * Initialize registry with NoopMetricsProvider
   */
  constructor() {
    this.provider = new NoopMetricsProvider();
  }

  /**
   * Set the metrics provider instance
   * @param {MetricsProvider} provider - Provider to use for this registry
   */
  setProvider(provider: MetricsProvider): void {
    this.provider = provider;
  }

  /**
   * Get the current metrics provider
   * @returns {MetricsProvider} Current provider instance
   */
  getProvider(): MetricsProvider {
    return this.provider;
  }

  /**
   * Get or create a meter for a specific scope
   * @param {string} scope - Scope name (e.g., 'render-engine', 'flow-runtime')
   * @returns {Meter} Meter instance for this scope
   */
  getMeter(scope: string): Meter {
    return this.provider.getMeter(scope);
  }

  /**
   * Trigger collection of all metrics
   * Delegates to provider if it supports collection
   */
  collect(): void {
    if (this.provider.collect) this.provider.collect();
  }
}

/**
 * Global metrics registry singleton instance
 * Use this directly for access to the provider, or use helper functions below
 * @type {GlobalMetricsRegistry}
 */
export const GlobalMetrics = new GlobalMetricsRegistry();

/**
 * Get a scoped meter for recording metrics
 * Convenience function that retrieves meter from global registry
 * @param {string} scope - Scope name for this meter
 * @returns {Meter} Meter instance for this scope
 * @example
 * ```typescript
 * const m = meter('my-component');
 * const counter = m.counter('operations_total');
 * ```
 */
export function meter(scope: string): Meter {
  return GlobalMetrics.getMeter(scope);
}

/**
 * Trigger collection of all metrics in the global provider
 * Useful before exporting metrics or generating snapshots
 * @example
 * ```typescript
 * collect();
 * const snapshot = GlobalMetrics.getProvider().snapshot();
 * ```
 */
export function collect(): void {
  GlobalMetrics.collect();
}

/**
 * Set the metrics provider for the global registry
 * Call this during application initialization to use a real provider
 * @param {MetricsProvider} provider - Provider instance to use globally
 * @example
 * ```typescript
 * import { InMemoryMetricsProvider } from '@/common/metrics';
 *
 * const provider = new InMemoryMetricsProvider();
 * setMetricsProvider(provider);
 * ```
 */
export function setMetricsProvider(provider: MetricsProvider): void {
  GlobalMetrics.setProvider(provider);
}

/**
 * Get the current global metrics provider
 * @returns {MetricsProvider} Current provider instance
 * @example
 * ```typescript
 * const provider = getMetricsProvider();
 * const snapshot = provider.snapshot?.();
 * ```
 */
export function getMetricsProvider(): MetricsProvider {
  return GlobalMetrics.getProvider();
}
