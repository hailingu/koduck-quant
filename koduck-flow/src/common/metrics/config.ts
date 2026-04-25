/**
 * @module src/common/metrics/config
 * @description Metrics configuration and governance settings
 * Provides functions to configure metrics behavior including series limits, TTL, sampling, and label filtering
 * @example
 * ```typescript
 * import { configureMetrics, getMetricsConfig } from '@/common/metrics';
 *
 * configureMetrics({
 *   governance: {
 *     seriesLimitPerMetric: 10000,
 *     seriesTTLms: 300000,
 *     samplingRate: 0.1
 *   },
 *   naming: {
 *     metricNamePrefix: 'myapp'
 *   }
 * });
 * ```
 */

import type { Attributes } from "./types";

/**
 * Governance configuration for metrics collection
 * Controls series limits, TTL, sampling, and attribute filtering
 * @interface MetricsGovernanceConfig
 * @property {number} [seriesLimitPerMetric] - Max distinct attribute series per metric (undefined = no limit)
 * @property {number} [seriesTTLms] - TTL for inactive series in milliseconds
 * @property {number} [samplingRate] - Sampling probability [0,1] for write-time filtering
 * @property {string[]} [labelWhitelist] - Only these attribute keys are kept if set
 * @property {string[]} [labelBlacklist] - These attribute keys are removed if set
 */
export interface MetricsGovernanceConfig {
  /**
   * Max distinct attribute series per metric name within a meter
   * New series beyond limit are dropped using LRU eviction
   * @default undefined (no limit)
   */
  seriesLimitPerMetric?: number;
  /**
   * Time-to-live for series inactivity in milliseconds
   * Pruned on collect() if last update older than TTL
   * @default undefined (no TTL)
   */
  seriesTTLms?: number;
  /**
   * Probability [0,1] to accept a measurement
   * Values < 1 enable random sampling on write
   * @default 1 (accept all)
   */
  samplingRate?: number;
  /**
   * If set, only these attribute keys are kept (whitelist)
   */
  labelWhitelist?: string[];
  /**
   * If set, these attribute keys are removed (blacklist)
   */
  labelBlacklist?: string[];
}

/**
 * Naming configuration for metrics
 * Controls metric naming conventions and prefixes
 * @interface MetricsNamingConfig
 * @property {string} [metricNamePrefix] - Optional global prefix for all exported metrics
 */
export interface MetricsNamingConfig {
  /**
   * Optional global prefix for exporter (e.g., 'myapp_')
   * Applied when rendering metrics for export
   */
  metricNamePrefix?: string;
}

/**
 * Root metrics configuration
 * Combines governance and naming configurations
 * @interface MetricsConfig
 * @property {MetricsGovernanceConfig} [governance] - Governance settings
 * @property {MetricsNamingConfig} [naming] - Naming settings
 */
export interface MetricsConfig {
  governance?: MetricsGovernanceConfig;
  naming?: MetricsNamingConfig;
}

let _config: MetricsConfig = {};

/**
 * Configure metrics collection behavior
 * Performs shallow merge with existing configuration to preserve unspecified defaults
 * @param {MetricsConfig} config - Configuration object with governance and/or naming settings
 * @example
 * ```typescript
 * configureMetrics({
 *   governance: {
 *     samplingRate: 0.1  // Sample 10% of measurements
 *   }
 * });
 * ```
 */
export function configureMetrics(config: MetricsConfig): void {
  // Shallow merge to preserve unspecified defaults
  _config = {
    ..._config,
    ...config,
    governance: { ..._config.governance, ...config.governance },
    naming: { ..._config.naming, ...config.naming },
  };
}

/**
 * Get the current metrics configuration
 * @returns {MetricsConfig} Current configuration object
 */
export function getMetricsConfig(): MetricsConfig {
  return _config;
}

/**
 * Filter attributes based on governance configuration
 * Applies whitelist/blacklist rules and returns filtered attributes
 * @param {Attributes} [attrs] - Original attributes to filter
 * @returns {Attributes|undefined} Filtered attributes or undefined if input was undefined
 * @internal
 */
export function filterAttributes(attrs: Attributes | undefined): Attributes | undefined {
  if (!attrs) return attrs;
  const g = _config.governance;
  if (!g) return attrs;
  const wl = g.labelWhitelist;
  const bl = g.labelBlacklist;
  const out: Attributes = {};
  if (wl?.length) {
    for (const k of wl) if (k in attrs) out[k] = attrs[k];
  } else {
    for (const k in attrs) out[k] = attrs[k];
  }
  if (bl?.length) {
    for (const k of bl) if (k in out) delete out[k];
  }
  return out;
}

/**
 * Determine if a measurement should be sampled based on sampling rate
 * Uses random selection with configured sampling probability
 * @returns {boolean} True if measurement should be recorded, false if filtered by sampling
 * @internal
 */
export function shouldSample(): boolean {
  const r = _config.governance?.samplingRate;
  if (r === undefined) return true;
  if (r >= 1) return true;
  if (r <= 0) return false;
  return Math.random() < r;
}
