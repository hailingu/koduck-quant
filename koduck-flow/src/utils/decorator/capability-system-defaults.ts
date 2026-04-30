import type { ICapabilitySystemConfig } from "./types";

export const CAPABILITY_CACHE_DEFAULT_TTL_MS = 300000;
export const CAPABILITY_CACHE_DEFAULT_MAX_SIZE = 1000;
export const CAPABILITY_CACHE_ACCESS_TIME_WINDOW = 1000;
export const CAPABILITY_CACHE_ACCESS_TIME_RETAINED = 500;
export const CAPABILITY_EXECUTION_DEFAULT_TIMEOUT_MS = 5000;
export const CAPABILITY_EXECUTION_DEFAULT_MAX_RETRIES = 3;

export function createDefaultCapabilitySystemConfig(
  overrides?: ICapabilitySystemConfig
): ICapabilitySystemConfig {
  return {
    cache: {
      enabled: true,
      defaultTtlMs: CAPABILITY_CACHE_DEFAULT_TTL_MS,
      maxSize: CAPABILITY_CACHE_DEFAULT_MAX_SIZE,
    },
    execution: {
      defaultTimeoutMs: CAPABILITY_EXECUTION_DEFAULT_TIMEOUT_MS,
      defaultMaxRetries: CAPABILITY_EXECUTION_DEFAULT_MAX_RETRIES,
      enablePerformanceTracking: true,
    },
    debug: { enabled: false, logLevel: "error" },
    ...overrides,
  };
}
