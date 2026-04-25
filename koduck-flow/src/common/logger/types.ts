/**
 * Logger 模块公共类型定义
 *
 * LoggerCore: 供事件系统等低耦合模块依赖的最小日志协议。
 * 语义：只约束四类方法；warn / error 为强制（语义最关键），debug / info 可选。
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFormat = "text" | "json";

export type LogMetadata = Record<string, unknown>;

export interface LogConfig {
  enabled: boolean;
  level: LogLevel;
  prefix?: string | undefined;
  format?: LogFormat | undefined;
  includeEmoji?: boolean | undefined;
  metadata?: LogMetadata | undefined;
}

/**
 * 最小日志协议（原 MinimalLogger，重命名为 LoggerCore）
 * - debug / info 可选，便于在精简模式下降低实现成本
 * - warn / error 必须，保障最关键的告警与错误通道不缺失
 */
export interface LoggerCore {
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export type LogArguments = [unknown, ...unknown[]];

export interface LogStructuredMessage {
  message?: string | undefined;
  event?: string | undefined;
  metadata?: LogMetadata | undefined;
  details?: unknown;
  error?: unknown;
  emoji?: string | undefined;
  tag?: string | undefined;
  [key: string]: unknown;
}

export interface LoggerContextOptions {
  tag?: string | undefined;
  emoji?: string | undefined;
  metadata?: LogMetadata | undefined;
}

export interface LoggerContextAdapter {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
}

/**
 * 兼容别名（如果后续需要迁移期，可开启导出）
 * export type MinimalLogger = LoggerCore;
 */
