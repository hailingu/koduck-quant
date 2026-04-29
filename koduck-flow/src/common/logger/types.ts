/**
 * Logger module public type definitions
 *
 * LoggerCore: minimal logging protocol for low-coupling modules such as the event system.
 * Semantics: only constrains four method types; warn / error are mandatory (semantically most critical), debug / info are optional.
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
 * Minimal logging protocol (formerly MinimalLogger, renamed to LoggerCore)
 * - debug / info are optional to reduce implementation cost in trimmed-down modes
 * - warn / error are mandatory to ensure the most critical warning and error channels are not missing
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
 * Compatibility alias (can be enabled during a migration period if needed)
 * export type MinimalLogger = LoggerCore;
 */
