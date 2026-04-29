import { getMinimalLogger } from "../logger/logger";
import type { EventConfiguration, Logger } from "./types";

/**
 * Error reporter
 * Responsible for collecting, formatting, and reporting errors during listener execution
 */
export class ErrorReporter {
  /** Flag to prevent recursive error reporting */
  private _isReportingErrors: boolean = false;

  /** Event name */
  private readonly _eventName: string;

  /** Event configuration */
  private _config: Readonly<EventConfiguration>;

  constructor(eventName: string, config: Readonly<EventConfiguration>) {
    this._eventName = eventName;
    this._config = config;
  }

  /**
   * Update configuration
   */
  updateConfiguration(config: Readonly<EventConfiguration>): void {
    this._config = config;
  }

  /**
   * Get current logger instance
   */
  private _getLogger(): Logger {
    return this._config.logger || getMinimalLogger();
  }

  /**
   * Report errors during listener execution
   * @param errors Array of errors
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
      // If logger also fails, at least output to console
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
   * Report warnings during async listener execution
   * @param index Listener index
   * @param error Error information
   * @param mode Concurrency mode
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
   * Report async listener timeout warnings
   * @param index Listener index
   * @param timeoutMs Timeout duration
   * @param mode Concurrency mode
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
   * Report batch timeout warnings
   * @param timeoutCount Number of timeouts
   * @param timeoutMs Timeout duration
   * @param mode Concurrency mode
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
   * Report configuration validation errors
   * @param configError Configuration error message
   */
  reportConfigError(configError: string): void {
    this._getLogger().error(
      `Event ${this._eventName} configuration error:`,
      configError
    );
  }

  /**
   * Report data validation failure
   */
  reportValidationFailure(): void {
    if (this._config.enableDebugMode) {
      this._getLogger().warn(
        `Event ${this._eventName}: Data validation failed`
      );
    }
  }

  /**
   * Report deduplication statistics (debug mode)
   * @param droppedCount Number of dropped events
   * @param totalCount Total number of events
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
   * Report batch processing statistics (debug mode)
   * @param batchSize Batch size
   * @param processedCount Number of processed events
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
   * Report memory cleanup information (debug mode)
   * @param type Cleanup type
   * @param count Number of cleaned items
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
   * Report performance warnings
   * @param message Warning message
   * @param metrics Related metrics
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
   * Report general debug information
   * @param message Debug message
   * @param data Related data
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
