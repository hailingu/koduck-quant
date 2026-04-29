/**
 * 事件系统公共类型
 *
 * Logger 接口已迁移为 LoggerCore（来自 common/logger）。
 * 如需最小日志协议，请从 "../logger" 导入 LoggerCore。
 */
import type { LoggerCore } from "../logger";
/** @deprecated 保留旧名兼容期，可直接使用 LoggerCore */
export type Logger = LoggerCore;

export interface Scheduler {
  /** 调度一个回调（可选延时参数仅对 timeout 类有效） */
  schedule: (fn: () => void, delay?: number) => number;
  /** 取消调度 */
  cancel: (id: number) => void;
  /** 调度器类型，用于内部优化或统计 */
  kind: "raf" | "timeout" | "custom";
}

/**
 * 事件负载去重配置（可选）
 */
export interface PayloadDedupeConfig {
  /** 是否启用去重（默认禁用） */
  enabled: boolean;
  /** 去重时间窗口（毫秒） */
  ttl: number;
  /** 去重缓存的最大条目数（可选） */
  maxEntries?: number;
  /** 生成去重 key 的函数（默认对 payload 执行 JSON.stringify） */
  key?: (data: unknown) => string;
}

/**
 * 事件监听器函数接口
 * @template T 事件数据类型
 */
export type IEventListener<T> = (args: T) => void;

/**
 * 事件注册函数接口
 * @template T 事件数据类型
 */
export type IEvent<T> = (listener: IEventListener<T>) => () => void;

/**
 * 事件系统配置接口
 * 控制事件的行为、性能和安全限制
 */
export interface EventConfiguration {
  // 批处理配置
  /** 是否启用批处理 */
  enableBatching: boolean;
  /** 批处理大小 */
  batchSize: number;
  /** 批处理间隔时间（毫秒） */
  batchInterval: number;

  // 自动优化配置
  /** 是否启用自动优化 */
  enableAutoOptimization: boolean;
  /** 自动优化触发的监听器数量阈值 */
  autoOptimizeThreshold: number;

  // 安全限制
  /** 最大监听器数量 */
  maxListeners: number;

  // 调试选项
  /** 是否启用调试模式 */
  enableDebugMode: boolean;

  // 并发选项（仅影响 fireAsync）
  /** 并发执行策略：串行、并行或受限并发 */
  concurrencyMode: "series" | "parallel" | "limited";
  /** 并发上限（仅在 limited 模式下生效） */
  concurrencyLimit: number;

  // 可插拔依赖
  /** 注入式日志器（默认使用 console） */
  logger?: LoggerCore;
  /** 注入式调度器（默认内部依据 rAF/timeout 选择） */
  scheduler?: Scheduler;

  // 监听器运行控制（主要用于 limited 并发增强）
  /** 单个监听器的超时时间（毫秒），0 或未设置表示不超时 */
  listenerTimeout?: number;
  /** 监听器超时时的取消回调（软取消，无法中断监听器执行，仅做通知） */
  onListenerCancel?: (info: {
    eventName: string;
    index: number;
    elapsed: number; // 实际已用时（毫秒）
    mode: "limited" | "parallel" | "series";
  }) => void;

  // 负载去重（短 TTL 幂等）
  /** 事件负载去重配置（默认禁用） */
  payloadDedupe?: PayloadDedupeConfig;
}

export type { IListenerSnapshotPool } from "./types/listener-snapshot-pool.interface";
