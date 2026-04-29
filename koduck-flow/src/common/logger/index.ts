/**
 * Logger module unified export entry
 * - Exposes Logger instance, config types, and minimal protocol (LoggerCore)
 * - Keeps getMinimalLogger compatibility (marked @deprecated)
 */
export { logger, getMinimalLogger, getLoggerCore, noopMinimalLogger } from "./logger";
export type {
  LogLevel,
  LogConfig,
  LogMetadata,
  LoggerCore,
  LoggerContextAdapter,
  LoggerContextOptions,
  LogStructuredMessage,
} from "./types";
