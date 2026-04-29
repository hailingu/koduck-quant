import type { KoduckFlowConfig } from "../../schema";

/**
 * Returns the default {@link KoduckFlowConfig} values for the browser environment.
 * @returns The default configuration object.
 */
export function loadDefaults(): KoduckFlowConfig {
  return {
    environment: "development",
    event: {
      batchSize: 10,
      batchInterval: 100,
      maxQueueSize: 1000,
      enableDedup: true,
      concurrencyLimit: 4,
      maxListeners: 1000,
    },
    render: {
      frameRate: 60,
      cacheTTL: 5 * 60 * 1000,
      maxCacheSize: 1000,
      defaultRenderer: "react",
      enableDirtyRegion: true,
      constants: {
        SMALL: 100,
        MEDIUM: 1000,
        LARGE: 5000,
      },
    },
    entity: {
      maxEntities: 10000,
      gcInterval: 5 * 60 * 1000,
      enableEntityPool: true,
    },
    performance: {
      enableProfiling: false,
      metricsInterval: 5000,
      enableVerboseLogging: false,
    },
    plugin: {
      sandboxTimeout: 5000,
      capabilityCache: {
        enabled: true,
        defaultTtlMs: 300000,
        maxSize: 1000,
      },
      execution: {
        defaultTimeoutMs: 5000,
        maxRetries: 3,
      },
    },
  };
}

/**
 * Returns config overrides loaded from a config file. Always returns an empty object in the browser environment.
 * @returns An empty partial config object.
 */
export function loadConfigFile(): Partial<KoduckFlowConfig> {
  return {};
}

/**
 * Returns config overrides sourced from environment variables. Always returns an empty object in the browser environment.
 * @returns An empty partial config object.
 */
export function loadEnvConfig(): Partial<KoduckFlowConfig> {
  return {};
}
