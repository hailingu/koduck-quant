import { getMinimalLogger } from "../logger/logger";
import type { EventConfiguration, Logger } from "./types";

/**
 * 错误报告器
 * 负责收集、格式化和报告监听器执行过程中的错误
 */
export class ErrorReporter {
  /** 错误报告中标志，防止递归 */
  private _isReportingErrors: boolean = false;

  /** 事件名称 */
  private readonly _eventName: string;

  /** 事件配置 */
  private _config: Readonly<EventConfiguration>;

  constructor(eventName: string, config: Readonly<EventConfiguration>) {
    this._eventName = eventName;
    this._config = config;
  }

  /**
   * 更新配置
   */
  updateConfiguration(config: Readonly<EventConfiguration>): void {
    this._config = config;
  }

  /**
   * 获取当前logger实例
   */
  private _getLogger(): Logger {
    return this._config.logger || getMinimalLogger();
  }

  /**
   * 报告监听器执行中的错误
   * @param errors 错误数组
   */
  reportErrors(errors: Array<{ index: number; error: unknown }>): void {
    if (this._isReportingErrors || errors.length === 0) {
      return;
    }

    this._isReportingErrors = true;

    try {
      const logger = this._getLogger();

      for (const { index, error } of errors) {
        logger.error(`Event ${this._eventName}[${index}]:`, error);
      }
    } catch (reportError) {
      // 如果logger也出错了，至少在控制台输出
      console.error(
        `Failed to report errors for event ${this._eventName}:`,
        reportError
      );
      console.error("Original errors:", errors);
    } finally {
      this._isReportingErrors = false;
    }
  }

  /**
   * 报告异步监听器执行中的警告
   * @param index 监听器索引
   * @param error 错误信息
   * @param mode 并发模式
   */
  reportAsyncWarning(
    index: number,
    error: unknown,
    mode: "parallel" | "limited" | "series"
  ): void {
    if (this._config.enableDebugMode) {
      this._getLogger().warn(
        `Event ${this._eventName} async listener[${index}] (${mode}):`,
        error
      );
    }
  }

  /**
   * 报告异步监听器超时警告
   * @param index 监听器索引
   * @param timeoutMs 超时时间
   * @param mode 并发模式
   */
  reportTimeoutWarning(
    index: number,
    timeoutMs: number,
    mode: "limited" | "parallel" | "series"
  ): void {
    if (this._config.enableDebugMode) {
      this._getLogger().warn(
        `Event ${this._eventName} async listener[${index}] exceeded timeout ${timeoutMs}ms (mode: ${mode}, soft-cancel)`
      );
    }
  }

  /**
   * 报告批量超时警告
   * @param timeoutCount 超时数量
   * @param timeoutMs 超时时间
   * @param mode 并发模式
   */
  reportBatchTimeoutWarning(
    timeoutCount: number,
    timeoutMs: number,
    mode: "limited" | "parallel" | "series"
  ): void {
    if (this._config.enableDebugMode) {
      this._getLogger().warn(
        `Event ${this._eventName}: ${timeoutCount} async listeners exceeded timeout ${timeoutMs}ms (mode: ${mode})`
      );
    }
  }

  /**
   * 报告配置验证错误
   * @param configError 配置错误信息
   */
  reportConfigError(configError: string): void {
    this._getLogger().error(
      `Event ${this._eventName} configuration error:`,
      configError
    );
  }

  /**
   * 报告数据验证失败
   */
  reportValidationFailure(): void {
    if (this._config.enableDebugMode) {
      this._getLogger().warn(
        `Event ${this._eventName}: Data validation failed`
      );
    }
  }

  /**
   * 报告去重统计信息（调试模式）
   * @param droppedCount 被丢弃的事件数量
   * @param totalCount 总事件数量
   */
  reportDedupeStats(droppedCount: number, totalCount: number): void {
    if (this._config.enableDebugMode && droppedCount > 0) {
      const logger = this._getLogger();
      if (logger.debug) {
        logger.debug(
          `Event ${this._eventName} dedupe stats: ${droppedCount}/${totalCount} events dropped`
        );
      }
    }
  }

  /**
   * 报告批处理统计信息（调试模式）
   * @param batchSize 批次大小
   * @param processedCount 处理的事件数量
   */
  reportBatchStats(batchSize: number, processedCount: number): void {
    if (this._config.enableDebugMode && processedCount > 0) {
      const logger = this._getLogger();
      if (logger.debug) {
        logger.debug(
          `Event ${this._eventName} batch processed: ${processedCount} events in batch size ${batchSize}`
        );
      }
    }
  }

  /**
   * 报告内存清理信息（调试模式）
   * @param type 清理类型
   * @param count 清理的项目数量
   */
  reportCleanupInfo(
    type: "listeners" | "batch" | "cache",
    count: number
  ): void {
    if (this._config.enableDebugMode && count > 0) {
      const logger = this._getLogger();
      if (logger.debug) {
        logger.debug(
          `Event ${this._eventName} cleanup: ${count} ${type} items cleared`
        );
      }
    }
  }

  /**
   * 报告性能警告
   * @param message 警告消息
   * @param metrics 相关指标
   */
  reportPerformanceWarning(
    message: string,
    metrics?: Record<string, number>
  ): void {
    if (this._config.enableDebugMode) {
      const logger = this._getLogger();
      logger.warn(`Event ${this._eventName} performance warning: ${message}`);
      if (metrics && logger.debug) {
        logger.debug("Performance metrics:", metrics);
      }
    }
  }

  /**
   * 报告一般性调试信息
   * @param message 调试消息
   * @param data 相关数据
   */
  reportDebugInfo(message: string, data?: unknown): void {
    if (this._config.enableDebugMode) {
      const logger = this._getLogger();
      if (logger.debug) {
        logger.debug(`Event ${this._eventName}: ${message}`);
        if (data !== undefined) {
          logger.debug("Debug data:", data);
        }
      }
    }
  }
}
