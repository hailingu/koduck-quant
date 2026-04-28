/**
 * @module src/common/logger/logger
 * @description Production-grade logging utility replacing direct console.* usage.
 * Provides structured logging with levels, context, metadata, and emoji indicators.
 * Designed for server and client environments with configurable log levels and output formatting.
 *
 * Core Features:
 * - **Structured Logging**: JSON-compatible log entries with metadata
 * - **Log Levels**: debug, info, warn, error with hierarchy enforcement
 * - **Context Support**: Thread-local context for request/operation tracking
 * - **Metadata Tracking**: Rich structured data attachment to log entries
 * - **Emoji Indicators**: Visual log level indicators for quick scanning
 * - **Error Serialization**: Automatic error object unwrapping and stack traces
 * - **Environment Detection**: Console output for browsers, stream output for Node.js
 *
 * Usage Pattern:
 * ```typescript
 * import { logger } from '@/logger';
 *
 * // Simple logging
 * logger.info('Operation started');
 * logger.error('Failed to process', { error, code: 500 });
 *
 * // Context-aware logging
 * const contextLogger = logger.withContext({ userId: '123', traceId: 'xyz' });
 * contextLogger.info('User action');
 *
 * // Structured messages
 * logger.info({
 *   message: 'Payment processed',
 *   metadata: { amount: 99.99, currency: 'USD' },
 *   tag: 'payment'
 * });
 * ```
 *
 * @example
 * ```typescript
 * import { logger } from '@/common/logger';
 * import type { LogLevel, LogMetadata } from '@/common/logger/types';
 *
 * // Basic logging by level
 * logger.debug('Debug information', { component: 'render' });
 * logger.info('Normal operation');
 * logger.warn('Warning condition', { severity: 'low' });
 * logger.error('Error occurred', { code: 'ERR_INVALID', stack: true });
 *
 * // Context-aware logging
 * const userLogger = logger.withContext({
 *   userId: 'user-123',
 *   sessionId: 'sess-456',
 *   environment: 'production'
 * });
 * userLogger.info('User logged in');
 *
 * // Structured message with metadata
 * logger.info({
 *   message: 'Transaction completed',
 *   metadata: {
 *     transactionId: 'txn-789',
 *     amount: 1000,
 *     currency: 'USD',
 *     timestamp: Date.now()
 *   },
 *   tag: 'payment:success',
 *   emoji: '💳'
 * });
 *
 * // Error logging with serialization
 * try {
 *   await processData(data);
 * } catch (error) {
 *   logger.error('Processing failed', {
 *     error: error instanceof Error ? error : new Error(String(error)),
 *     data,
 *     retryable: true,
 *     nextRetry: Date.now() + 5000
 *   });
 * }
 *
 * // Log level filtering
 * logger.setLevel('warn'); // Only warn and error
 * logger.info('Not logged'); // Skipped
 * logger.warn('Still logged'); // Output
 * ```
 */

/**
 * 日志工具 - 用于生产环境的日志管理
 * 替代直接使用 console.* 的调试输出
 */

// Basic types migrated to types.ts, re-exported to avoid breaking changes
import type {
  LogConfig,
  LogLevel,
  LogMetadata,
  LoggerCore,
  LoggerContextAdapter,
  LoggerContextOptions,
  LogStructuredMessage,
} from "./types";

export type {
  LogLevel,
  LogConfig,
  LogMetadata,
  LoggerCore,
  LoggerContextAdapter,
  LoggerContextOptions,
  LogStructuredMessage,
} from "./types";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_EMOJI: Record<LogLevel, string> = {
  debug: "🐛",
  info: "ℹ️",
  warn: "⚠️",
  error: "🚨",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isStructuredPayload(value: unknown): value is LogStructuredMessage {
  if (!isPlainObject(value)) return false;
  return ["message", "event", "metadata", "details", "error", "emoji", "tag"].some(
    (key) => key in value
  );
}

function mergeMetadata(base?: LogMetadata, extra?: LogMetadata): LogMetadata | undefined {
  if (!base && !extra) return undefined;
  return {
    ...(base ?? {}),
    ...(extra ?? {}),
  };
}

function serializeError(error: Error): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };

  if (error.stack) {
    serialized.stack = error.stack;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    serialized.cause = cause;
  }

  return serialized;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    const result = JSON.stringify(value);
    return result ?? String(value);
  } catch {
    return String(value);
  }
}

class Logger {
  private config: LogConfig = {
    enabled: import.meta.env?.DEV ?? false,
    level: "warn",
    prefix: "[KoduckFlow]",
    format: "text",
    includeEmoji: false,
    metadata: undefined,
  };

  setConfig(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    const current = LEVEL_ORDER[this.config.level];
    const target = LEVEL_ORDER[level];
    return target >= current;
  }

  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case "debug":
        return console.debug.bind(console);
      case "info":
        return console.info.bind(console);
      case "warn":
        return console.warn.bind(console);
      case "error":
      default:
        return console.error.bind(console);
    }
  }

  private resolvePayload(
    level: LogLevel,
    args: unknown[],
    context?: LoggerContextOptions
  ): { record: LogStructuredMessage; trailing: unknown[] } | null {
    if (args.length === 0) return null;

    const [first, ...rest] = args;
    let payload: LogStructuredMessage;

    if (first instanceof Error) {
      payload = {
        message: first.message,
        error: first,
      };
    } else if (isStructuredPayload(first)) {
      payload = { ...first };
    } else if (typeof first === "string") {
      payload = { message: first };
    } else {
      payload = { message: stringify(first) };
    }

    if (payload.details === undefined && rest.length > 0) {
      payload.details = rest.length === 1 ? rest[0] : rest;
    }

    const emojiCandidate =
      payload.emoji ??
      context?.emoji ??
      (this.config.includeEmoji ? DEFAULT_EMOJI[level] : undefined);
    if (emojiCandidate) {
      payload.emoji = emojiCandidate;
    }

    if (context?.tag && !payload.tag) {
      payload.tag = context.tag;
    }

    const mergedMetadata = mergeMetadata(
      mergeMetadata(this.config.metadata, payload.metadata),
      context?.metadata
    );
    if (mergedMetadata) {
      payload.metadata = mergedMetadata;
    }

    return { record: payload, trailing: rest };
  }

  private toJsonEntry(level: LogLevel, payload: LogStructuredMessage): string {
    const errorValue =
      payload.error instanceof Error ? serializeError(payload.error) : payload.error;

    const data: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      prefix: this.config.prefix,
      message: payload.message,
      event: payload.event,
      tag: payload.tag,
      emoji: payload.emoji,
      metadata: payload.metadata,
      details: payload.details,
      error: errorValue,
    };

    const filtered = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );

    return JSON.stringify(filtered);
  }

  private toTextEntry(level: LogLevel, payload: LogStructuredMessage): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `${this.config.prefix} ` : "";
    const scopeParts = [`[${level.toUpperCase()}]`];

    if (payload.emoji) {
      scopeParts.push(payload.emoji);
    }

    if (payload.tag) {
      scopeParts.push(`#${payload.tag}`);
    }

    if (payload.event) {
      scopeParts.push(`(${payload.event})`);
    }

    const head = `${timestamp} ${prefix}${scopeParts.join(" ")}`.trim();
    const segments: string[] = [head];

    if (payload.message) {
      segments.push(payload.message);
    }

    if (payload.details !== undefined) {
      segments.push(`details=${stringify(payload.details)}`);
    }

    if (payload.metadata) {
      segments.push(`meta=${stringify(payload.metadata)}`);
    }

    if (payload.error) {
      const errorValue =
        payload.error instanceof Error ? serializeError(payload.error) : payload.error;
      segments.push(`error=${stringify(errorValue)}`);
    }

    return segments.join(" | ");
  }

  private emit(level: LogLevel, args: unknown[], context?: LoggerContextOptions): void {
    if (!this.shouldLog(level)) return;
    const normalized = this.resolvePayload(level, args, context);
    if (!normalized) return;

    const { record, trailing } = normalized;
    const formatter =
      this.config.format === "json" ? this.toJsonEntry.bind(this) : this.toTextEntry.bind(this);
    const entry = formatter(level, record);

    const consoleMethod = this.getConsoleMethod(level);
    consoleMethod(entry, ...trailing);
  }

  debug(...args: unknown[]): void {
    this.emit("debug", args);
  }

  info(...args: unknown[]): void {
    this.emit("info", args);
  }

  warn(...args: unknown[]): void {
    this.emit("warn", args);
  }

  error(...args: unknown[]): void {
    this.emit("error", args);
  }

  private timeInternal(label: string, context?: LoggerContextOptions): void {
    if (!this.shouldLog("debug")) return;
    const prefix = this.config.prefix ? `${this.config.prefix} ` : "";
    const timerContext: Record<string, unknown> = {};
    if (context?.tag) {
      timerContext.tag = context.tag;
    }
    if (context?.metadata) {
      Object.assign(timerContext, context.metadata);
    }
    const suffix = Object.keys(timerContext).length ? ` ${stringify(timerContext)}` : "";
    console.time(`${prefix}${label}${suffix}`);
  }

  private timeEndInternal(label: string, context?: LoggerContextOptions): void {
    if (!this.shouldLog("debug")) return;
    const prefix = this.config.prefix ? `${this.config.prefix} ` : "";
    const timerContext: Record<string, unknown> = {};
    if (context?.tag) {
      timerContext.tag = context.tag;
    }
    if (context?.metadata) {
      Object.assign(timerContext, context.metadata);
    }
    const suffix = Object.keys(timerContext).length ? ` ${stringify(timerContext)}` : "";
    console.timeEnd(`${prefix}${label}${suffix}`);
  }

  time(label: string): void {
    this.timeInternal(label);
  }

  timeEnd(label: string): void {
    this.timeEndInternal(label);
  }

  child(context: Record<string, unknown>): LoggerContextAdapter {
    return this.withContext({
      tag: typeof context.tag === "string" ? (context.tag as string) : undefined,
      metadata: context,
    });
  }

  withContext(options: LoggerContextOptions): LoggerContextAdapter {
    const context: LoggerContextOptions = {
      tag: options.tag,
      emoji: options.emoji,
      metadata: options.metadata,
    };

    return {
      debug: (...args: unknown[]) => this.emit("debug", args, context),
      info: (...args: unknown[]) => this.emit("info", args, context),
      warn: (...args: unknown[]) => this.emit("warn", args, context),
      error: (...args: unknown[]) => this.emit("error", args, context),
      time: (label: string) => this.timeInternal(label, context),
      timeEnd: (label: string) => this.timeEndInternal(label, context),
    };
  }

  asMinimal(): LoggerCore {
    return this.asCore();
  }

  asCore(): LoggerCore {
    return {
      debug: () => {},
      info: () => {},
      warn: (...args: unknown[]) => this.warn(...args),
      error: (...args: unknown[]) => this.error(...args),
    };
  }
}

// 导出单例实例
export const logger = new Logger();
logger.setConfig({
  enabled: import.meta.env?.DEV ?? false,
  level: "debug",
});

/**
 * 一个空实现的最小 Logger，用于完全静默（测试或生产禁用场景）
 */
export const noopMinimalLogger: LoggerCore = {
  debug: function () {},
  info: function () {},
  warn: function () {},
  error: function () {},
};

/**
 * 便捷方法：获取当前全局 logger 的最小适配体（事件系统可直接注入）
 */
/**
 * @deprecated 请使用 getLoggerCore()
 */
export function getMinimalLogger(): LoggerCore {
  return logger.asMinimal();
}

/**
 * 获取全局 logger 的最小协议实例（LoggerCore）
 */
export function getLoggerCore(): LoggerCore {
  return logger.asCore();
}

// 在生产环境中默认禁用日志
// 可以通过 logger.setConfig({ enabled: true }) 手动启用
