import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorReporter } from "../../src/common/event/error-reporter";
import type { EventConfiguration, Logger } from "../../src/common/event/types";

describe("ErrorReporter", () => {
  let config: EventConfiguration;
  let errorReporter: ErrorReporter;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };

    config = {
      maxListeners: 100,
      enableBatching: false,
      batchSize: 10,
      batchInterval: 0,
      enableAutoOptimization: false,
      autoOptimizeThreshold: 1000,
      enableDebugMode: false,
      concurrencyMode: "parallel" as const,
      concurrencyLimit: 5,
      logger: mockLogger,
    };

    errorReporter = new ErrorReporter("TestEvent", config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Constructor and configuration", () => {
    test("should correctly initialize error reporter", () => {
      expect(errorReporter).toBeDefined();
    });

    test("should be able to update configuration", () => {
      const newConfig = { ...config, enableDebugMode: true };

      expect(() => {
        errorReporter.updateConfiguration(newConfig);
      }).not.toThrow();
    });
  });

  describe("Basic error reporting", () => {
    test("should report listener execution errors", () => {
      const errors = [
        { index: 0, error: new Error("Test error 1") },
        { index: 1, error: new Error("Test error 2") },
      ];

      errorReporter.reportErrors(errors);

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Event TestEvent[0]:",
        errors[0].error
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Event TestEvent[1]:",
        errors[1].error
      );
    });

    test("should handle empty error arrays", () => {
      errorReporter.reportErrors([]);

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test("should prevent recursive error reporting", () => {
      const recursiveLogger: Logger = {
        error: vi.fn().mockImplementation(() => {
          // Simulate triggering an error while reporting an error
          errorReporter.reportErrors([
            { index: 2, error: new Error("Recursive error") },
          ]);
        }),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      };

      const recursiveConfig = { ...config, logger: recursiveLogger };
      const recursiveReporter = new ErrorReporter(
        "RecursiveEvent",
        recursiveConfig
      );

      recursiveReporter.reportErrors([
        { index: 0, error: new Error("Initial error") },
      ]);

      // Should only be called once, recursive calls should be blocked
      expect(recursiveLogger.error).toHaveBeenCalledTimes(1);
    });

    test("should handle Logger errors", () => {
      const faultyLogger: Logger = {
        error: vi.fn().mockImplementation(() => {
          throw new Error("Logger error");
        }),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      };

      const faultyConfig = { ...config, logger: faultyLogger };
      const faultyReporter = new ErrorReporter("FaultyEvent", faultyConfig);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      faultyReporter.reportErrors([
        { index: 0, error: new Error("Test error") },
      ]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to report errors for event FaultyEvent:",
        expect.any(Error)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "Original errors:",
        expect.any(Array)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Async error reporting", () => {
    test("should report async listener warnings in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportAsyncWarning(1, new Error("Async error"), "parallel");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent async listener[1] (parallel):",
        expect.any(Error)
      );
    });

    test("should not report async listener warnings in non-debug mode", () => {
      errorReporter.reportAsyncWarning(1, new Error("Async error"), "parallel");

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test("should report timeout warnings in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportTimeoutWarning(2, 5000, "limited");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent async listener[2] exceeded timeout 5000ms (mode: limited, soft-cancel)"
      );
    });

    test("should report batch timeout warnings in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportBatchTimeoutWarning(3, 3000, "parallel");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent: 3 async listeners exceeded timeout 3000ms (mode: parallel)"
      );
    });
  });

  describe("Configuration and validation errors", () => {
    test("should report configuration errors", () => {
      errorReporter.reportConfigError("Invalid maxListeners value");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Event TestEvent configuration error:",
        "Invalid maxListeners value"
      );
    });

    test("should report validation failures in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportValidationFailure();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent: Data validation failed"
      );
    });

    test("should not report validation failures in non-debug mode", () => {
      errorReporter.reportValidationFailure();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe("Statistics and debug information", () => {
    test("should report deduplication statistics in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportDedupeStats(5, 20);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent dedupe stats: 5/20 events dropped"
      );
    });

    test("should not report deduplication statistics when no events were dropped", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportDedupeStats(0, 20);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test("should report batch statistics in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportBatchStats(10, 8);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent batch processed: 8 events in batch size 10"
      );
    });

    test("should not report batch statistics when no events were processed", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportBatchStats(10, 0);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test("should report cleanup information in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportCleanupInfo("listeners", 5);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent cleanup: 5 listeners items cleared"
      );
    });

    test("should test all cleanup types", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportCleanupInfo("batch", 3);
      debugReporter.reportCleanupInfo("cache", 2);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent cleanup: 3 batch items cleared"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent cleanup: 2 cache items cleared"
      );
    });

    test("should not report cleanup information when there are no items to clean", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportCleanupInfo("listeners", 0);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("Performance and debug reporting", () => {
    test("should report performance warnings in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportPerformanceWarning("High memory usage detected");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent performance warning: High memory usage detected"
      );
    });

    test("should report performance warnings and metrics in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      const metrics = { memory: 1024, listeners: 50 };
      debugReporter.reportPerformanceWarning("Performance issue", metrics);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent performance warning: Performance issue"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Performance metrics:",
        metrics
      );
    });

    test("should report debug information in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportDebugInfo("Processing started");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent: Processing started"
      );
    });

    test("should report debug information and data in debug mode", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      const debugData = { step: 1, status: "active" };
      debugReporter.reportDebugInfo("Processing step", debugData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent: Processing step"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith("Debug data:", debugData);
    });

    test("should not report performance warnings in non-debug mode", () => {
      errorReporter.reportPerformanceWarning("Performance issue");

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test("should not report debug information in non-debug mode", () => {
      errorReporter.reportDebugInfo("Debug message");

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("Default Logger handling", () => {
    test("should use default Logger when no Logger is configured", () => {
      const configWithoutLogger = { ...config };
      delete configWithoutLogger.logger;

      const defaultLoggerReporter = new ErrorReporter(
        "DefaultEvent",
        configWithoutLogger
      );

      // This should not throw because default logger will be used
      expect(() => {
        defaultLoggerReporter.reportErrors([
          { index: 0, error: new Error("Test") },
        ]);
      }).not.toThrow();
    });

    test("should handle Logger missing debug method", () => {
      const incompleteLogger: Partial<Logger> = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        // Missing debug method
      };

      const incompleteConfig = {
        ...config,
        logger: incompleteLogger as Logger,
        enableDebugMode: true,
      };
      const incompleteReporter = new ErrorReporter(
        "IncompleteEvent",
        incompleteConfig
      );

      // Should not throw even if logger has no debug method
      expect(() => {
        incompleteReporter.reportDebugInfo("Test debug");
      }).not.toThrow();
    });
  });

  describe("Edge cases", () => {
    test("should handle different concurrency modes", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportAsyncWarning(0, new Error("Error"), "series");
      debugReporter.reportTimeoutWarning(1, 1000, "series");
      debugReporter.reportBatchTimeoutWarning(2, 2000, "series");

      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("(series)"),
        expect.any(Error)
      );
    });

    test("should handle various error types", () => {
      const errors = [
        { index: 0, error: new Error("Standard error") },
        { index: 1, error: "String error" },
        { index: 2, error: 42 },
        { index: 3, error: null },
        { index: 4, error: undefined },
        { index: 5, error: { custom: "object error" } },
      ];

      errorReporter.reportErrors(errors);

      expect(mockLogger.error).toHaveBeenCalledTimes(6);
      errors.forEach((errorItem, index) => {
        expect(mockLogger.error).toHaveBeenNthCalledWith(
          index + 1,
          `Event TestEvent[${errorItem.index}]:`,
          errorItem.error
        );
      });
    });

    test("should handle extremely large index values", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportTimeoutWarning(
        Number.MAX_SAFE_INTEGER,
        5000,
        "parallel"
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Event DebugEvent async listener[${Number.MAX_SAFE_INTEGER}] exceeded timeout 5000ms (mode: parallel, soft-cancel)`
      );
    });
  });
});
