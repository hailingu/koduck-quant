/**
 * KoduckFlow Configuration TypeScript Declarations
 *
 * Generated from Zod schema - DO NOT EDIT MANUALLY
 */

export interface KoduckFlowConfig {
  environment: "development" | "staging" | "production";
  event: {
    batchSize: number;
    batchInterval: number;
    maxQueueSize: number;
    enableDedup: boolean;
    concurrencyLimit: number;
    maxListeners: number;
  };
  render: {
    frameRate: number;
    cacheTTL: number;
    maxCacheSize: number;
    defaultRenderer: "react" | "canvas" | "webgpu";
    enableDirtyRegion: boolean;
    constants: {
      SMALL: number;
      MEDIUM: number;
      LARGE: number;
    };
  };
  entity: {
    maxEntities: number;
    gcInterval: number;
    enableEntityPool: boolean;
  };
  performance: {
    enableProfiling: boolean;
    metricsInterval: number;
    enableVerboseLogging: boolean;
  };
  tenant?: {
    enabled: boolean;
    defaultQuota: {
      maxEntities: number;
      maxFlows: number;
      storageLimit: number;
    };
  };
  plugin: {
    sandboxTimeout: number;
    capabilityCache: {
      enabled: boolean;
      defaultTtlMs: number;
      maxSize: number;
    };
    execution: {
      defaultTimeoutMs: number;
      maxRetries: number;
    };
  };
}
