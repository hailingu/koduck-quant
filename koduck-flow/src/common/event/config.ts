import type { EventConfiguration, PayloadDedupeConfig } from "./types";
import { logger as globalLogger } from "../logger/logger";

/**
 * 事件预设配置
 */
export const EventPreset = {
  /** 默认配置：平衡性能和功能 */
  Default: "default" as const,
  /** 高性能配置：优化大量事件处理 */
  HighPerformance: "high-performance" as const,
  /** 低延迟配置：最小化处理延迟 */
  LowLatency: "low-latency" as const,
  /** 调试配置：开启详细日志和验证 */
  Debug: "debug" as const,
} as const;

export type EventPreset = (typeof EventPreset)[keyof typeof EventPreset];

/**
 * 预定义的事件配置方案
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
 * 事件配置验证器
 */
export class EventConfigValidator {
  /**
   * 验证和标准化事件配置
   * @param config - 部分配置对象
   * @returns 完整的验证后配置
   */
  static validate(config: Partial<EventConfiguration>): EventConfiguration {
    const validated = { ...EVENT_PRESETS[EventPreset.Default], ...config };

    // 数值范围验证
    validated.batchSize = Math.max(1, Math.min(validated.batchSize, 1000));
    validated.batchInterval = Math.max(0, Math.min(validated.batchInterval, 1000));
    validated.maxListeners = Math.max(1, Math.min(validated.maxListeners, 10000));
    validated.autoOptimizeThreshold = Math.max(1, validated.autoOptimizeThreshold);

    // 逻辑一致性验证
    if (!validated.enableBatching) {
      validated.batchSize = 1;
      validated.batchInterval = 0;
    }

    if (!validated.enableAutoOptimization) {
      validated.autoOptimizeThreshold = Infinity;
    }

    // 并发参数范围与一致性
    if (
      validated.concurrencyMode !== "series" &&
      validated.concurrencyMode !== "parallel" &&
      validated.concurrencyMode !== "limited"
    ) {
      validated.concurrencyMode = "series";
    }
    validated.concurrencyLimit = Math.max(1, Math.min(validated.concurrencyLimit ?? 4, 1000));

    // 监听器超时规范化（仅作为软限制）
    if (validated.listenerTimeout !== undefined) {
      const t = Math.max(0, Math.min(Math.floor(validated.listenerTimeout), 60_000));
      validated.listenerTimeout = t;
    }

    // 配置冲突检查
    if (validated.autoOptimizeThreshold > validated.maxListeners) {
      globalLogger.warn(
        `[EventConfig] autoOptimizeThreshold (${validated.autoOptimizeThreshold}) ` +
          `cannot exceed maxListeners (${validated.maxListeners}). Adjusting to maxListeners.`
      );
      validated.autoOptimizeThreshold = validated.maxListeners;
    }

    // 负载去重规范化
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
