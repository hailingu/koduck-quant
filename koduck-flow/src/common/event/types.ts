/**
 * Event system public types
 *
 * Logger interface has been migrated to LoggerCore (from common/logger).
 * For minimal logging protocol, import LoggerCore from "../logger".
 */
import type { LoggerCore } from "../logger";
/** @deprecated Retained for backward compatibility, use LoggerCore directly */
export type Logger = LoggerCore;

export interface Scheduler {
  /** Schedule a callback (optional delay parameter only valid for timeout type) */
  schedule: (fn: () => void, delay?: number) => number;
  /** Cancel scheduling */
  cancel: (id: number) => void;
  /** Scheduler type, for internal optimization or statistics */
  kind: "raf" | "timeout" | "custom";
}

/**
 * Event payload deduplication configuration (optional)
 */
export interface PayloadDedupeConfig {
  /** Whether to enable deduplication (disabled by default) */
  enabled: boolean;
  /** Deduplication time window in milliseconds */
  ttl: number;
  /** Maximum entries in deduplication cache (optional) */
  maxEntries?: number;
  /** Function to generate deduplication key (defaults to JSON.stringify on payload) */
  key?: (data: unknown) => string;
}

/**
 * Event listener function interface
 * @template T Event data type
 */
export type IEventListener<T> = (args: T) => void;

/**
 * Event registration function interface
 * @template T Event data type
 */
export type IEvent<T> = (listener: IEventListener<T>) => () => void;

/**
 * Event system configuration interface
 * Controls event behavior, performance, and security limits
 */
export interface EventConfiguration {
  // Batch configuration
  /** Whether to enable batch processing */
  enableBatching: boolean;
  /** Batch size */
  batchSize: number;
  /** Batch interval time in milliseconds */
  batchInterval: number;

  // Auto-optimization configuration
  /** Whether to enable auto-optimization */
  enableAutoOptimization: boolean;
  /** Listener count threshold to trigger auto-optimization */
  autoOptimizeThreshold: number;

  // Security limits
  /** Maximum number of listeners */
  maxListeners: number;

  // Debug options
  /** Whether to enable debug mode */
  enableDebugMode: boolean;

  // Concurrency options (only affects fireAsync)
  /** Concurrency execution strategy: series, parallel, or limited */
  concurrencyMode: "series" | "parallel" | "limited";
  /** Concurrency limit (only effective in limited mode) */
  concurrencyLimit: number;

  // Pluggable dependencies
  /** Injected logger (defaults to console) */
  logger?: LoggerCore;
  /** Injected scheduler (defaults to internal rAF/timeout selection) */
  scheduler?: Scheduler;

  // Listener execution control (mainly for limited concurrency enhancement)
  /** Single listener timeout in milliseconds, 0 or unset means no timeout */
  listenerTimeout?: number;
  /** Listener timeout cancellation callback (soft cancel, cannot interrupt listener execution, notification only) */
  onListenerCancel?: (info: {
    eventName: string;
    index: number;
    elapsed: number; // Actual elapsed time in milliseconds
    mode: "limited" | "parallel" | "series";
  }) => void;

  // Payload deduplication (short TTL idempotency)
  /** Event payload deduplication configuration (disabled by default) */
  payloadDedupe?: PayloadDedupeConfig;
}

export type { IListenerSnapshotPool } from "./types/listener-snapshot-pool.interface";
