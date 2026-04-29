import type { EventConfiguration, PayloadDedupeConfig } from "./types";
import { logger as globalLogger } from "../logger/logger";

/**
 * Event preset configurations
 */
export const EventPreset = {
  /** Default config: balanced performance and functionality */
  Default: "default" as const,
  /** High-performance config: optimized for high-volume event processing */
  HighPerformance: "high-performance" as const,
  /** Low-latency config: minimizes processing latency */
  LowLatency: "low-latency" as const,
  /** Debug config: enables detailed logging and validation */
  Debug: "debug" as const,
} as const;

export type EventPreset = (typeof EventPreset)[keyof typeof EventPreset];

/**
 * Predefined event configuration schemes
 */
export const EVENT_PRESETS: Record<EventPreset, EventConfiguration> = {
  [EventPreset.Default]: {
    enableBatching: true,
    batchSize: 50,
    batchInterval: 16,
    enableAutoOptimization: true,
    autoOptimizeThreshold: 10,
    maxListeners: 100,
    enableDebugMode: false,
    concurrencyMode: "series",
    concurrencyLimit: 4,
  },

  [EventPreset.HighPerformance]: {
    enableBatching: true,
    batchSize: 100,
    batchInterval: 8,
    enableAutoOptimization: true,
    autoOptimizeThreshold: 5,
    maxListeners: 1000,
    enableDebugMode: false,
    concurrencyMode: "series",
    concurrencyLimit: 8,
  },

  [EventPreset.LowLatency]: {
    enableBatching: false,
    batchSize: 1,
    batchInterval: 0,
    enableAutoOptimization: false,
    autoOptimizeThreshold: Infinity,
    maxListeners: 50,
    enableDebugMode: false,
    concurrencyMode: "series",
    concurrencyLimit: 2,
  },

  [EventPreset.Debug]: {
    enableBatching: true,
    batchSize: 10,
    batchInterval: 32,
    enableAutoOptimization: false,
    autoOptimizeThreshold: Infinity,
    maxListeners: 50,
    enableDebugMode: true,
    concurrencyMode: "series",
    concurrencyLimit: 4,
  },
};

/**
 * Event configuration validator
 */
export class EventConfigValidator {
  /**
   * Validate and normalize event configuration
   * @param config - Partial configuration object
   * @returns Complete validated configuration
   */
  static validate(config: Partial<EventConfiguration>): EventConfiguration {
    const validated = { ...EVENT_PRESETS[EventPreset.Default], ...config };

    // Numeric range validation
    validated.batchSize = Math.max(1, Math.min(validated.batchSize, 1000));
    validated.batchInterval = Math.max(0, Math.min(validated.batchInterval, 1000));
    validated.maxListeners = Math.max(1, Math.min(validated.maxListeners, 10000));
    validated.autoOptimizeThreshold = Math.max(1, validated.autoOptimizeThreshold);

    // Logical consistency validation
    if (!validated.enableBatching) {
      validated.batchSize = 1;
      validated.batchInterval = 0;
    }

    if (!validated.enableAutoOptimization) {
      validated.autoOptimizeThreshold = Infinity;
    }

    // Concurrency parameter range and consistency
    if (
      validated.concurrencyMode !== "series" &&
      validated.concurrencyMode !== "parallel" &&
      validated.concurrencyMode !== "limited"
    ) {
      validated.concurrencyMode = "series";
    }
    validated.concurrencyLimit = Math.max(1, Math.min(validated.concurrencyLimit ?? 4, 1000));

    // Listener timeout normalization (soft limit only)
    if (validated.listenerTimeout !== undefined) {
      const t = Math.max(0, Math.min(Math.floor(validated.listenerTimeout), 60_000));
      validated.listenerTimeout = t;
    }

    // Configuration conflict check
    if (validated.autoOptimizeThreshold > validated.maxListeners) {
      globalLogger.warn(
        `[EventConfig] autoOptimizeThreshold (${validated.autoOptimizeThreshold}) ` +
          `cannot exceed maxListeners (${validated.maxListeners}). Adjusting to maxListeners.`
      );
      validated.autoOptimizeThreshold = validated.maxListeners;
    }

    // Payload deduplication normalization
    if (validated.payloadDedupe) {
      const d = validated.payloadDedupe;
      const enabled = !!d.enabled;
      const ttl = Math.max(1, Math.min(Math.floor(d.ttl ?? 0), 60_000));
      const maxEntriesValue =
        d.maxEntries !== undefined ? Math.max(1, Math.floor(d.maxEntries)) : undefined;
      const keyFn = d.key && typeof d.key === "function" ? d.key : undefined;

      if (enabled) {
        const normalized: PayloadDedupeConfig = {
          enabled: true,
          ttl,
        };

        if (maxEntriesValue !== undefined) {
          normalized.maxEntries = maxEntriesValue;
        }

        if (keyFn !== undefined) {
          normalized.key = keyFn;
        }

        validated.payloadDedupe = normalized;
      } else {
        validated.payloadDedupe = { enabled: false, ttl: 0 };
      }
    }

    return validated;
  }
}
