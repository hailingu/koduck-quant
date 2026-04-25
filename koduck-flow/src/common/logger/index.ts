/**
 * Logger 模块统一导出入口
 * - 对外暴露 Logger 实例、配置类型、最小协议 (LoggerCore)
 * - 保留 getMinimalLogger 兼容（标记 @deprecated）
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
