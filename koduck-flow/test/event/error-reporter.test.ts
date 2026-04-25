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

  describe("构造函数和配置", () => {
    test("应该正确初始化错误报告器", () => {
      expect(errorReporter).toBeDefined();
    });

    test("应该能更新配置", () => {
      const newConfig = { ...config, enableDebugMode: true };

      expect(() => {
        errorReporter.updateConfiguration(newConfig);
      }).not.toThrow();
    });
  });

  describe("基础错误报告", () => {
    test("应该报告监听器执行错误", () => {
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

    test("应该处理空错误数组", () => {
      errorReporter.reportErrors([]);

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test("应该防止递归错误报告", () => {
      const recursiveLogger: Logger = {
        error: vi.fn().mockImplementation(() => {
          // 模拟在报告错误时又触发错误
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

      // 只应该调用一次，递归调用应该被阻止
      expect(recursiveLogger.error).toHaveBeenCalledTimes(1);
    });

    test("应该处理Logger出错的情况", () => {
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

  describe("异步错误报告", () => {
    test("应该在调试模式下报告异步监听器警告", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportAsyncWarning(1, new Error("Async error"), "parallel");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent async listener[1] (parallel):",
        expect.any(Error)
      );
    });

    test("应该在非调试模式下不报告异步监听器警告", () => {
      errorReporter.reportAsyncWarning(1, new Error("Async error"), "parallel");

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test("应该在调试模式下报告超时警告", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportTimeoutWarning(2, 5000, "limited");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent async listener[2] exceeded timeout 5000ms (mode: limited, soft-cancel)"
      );
    });

    test("应该在调试模式下报告批量超时警告", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportBatchTimeoutWarning(3, 3000, "parallel");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent: 3 async listeners exceeded timeout 3000ms (mode: parallel)"
      );
    });
  });

  describe("配置和验证错误", () => {
    test("应该报告配置错误", () => {
      errorReporter.reportConfigError("Invalid maxListeners value");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Event TestEvent configuration error:",
        "Invalid maxListeners value"
      );
    });

    test("应该在调试模式下报告验证失败", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportValidationFailure();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent: Data validation failed"
      );
    });

    test("应该在非调试模式下不报告验证失败", () => {
      errorReporter.reportValidationFailure();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe("统计和调试信息", () => {
    test("应该在调试模式下报告去重统计", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportDedupeStats(5, 20);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent dedupe stats: 5/20 events dropped"
      );
    });

    test("应该在没有被丢弃事件时不报告去重统计", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportDedupeStats(0, 20);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test("应该在调试模式下报告批处理统计", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportBatchStats(10, 8);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent batch processed: 8 events in batch size 10"
      );
    });

    test("应该在没有处理事件时不报告批处理统计", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportBatchStats(10, 0);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    test("应该在调试模式下报告清理信息", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportCleanupInfo("listeners", 5);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent cleanup: 5 listeners items cleared"
      );
    });

    test("应该测试所有清理类型", () => {
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

    test("应该在没有清理项目时不报告清理信息", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportCleanupInfo("listeners", 0);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("性能和调试报告", () => {
    test("应该在调试模式下报告性能警告", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportPerformanceWarning("High memory usage detected");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Event DebugEvent performance warning: High memory usage detected"
      );
    });

    test("应该在调试模式下报告性能警告和指标", () => {
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

    test("应该在调试模式下报告调试信息", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      debugReporter.reportDebugInfo("Processing started");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent: Processing started"
      );
    });

    test("应该在调试模式下报告调试信息和数据", () => {
      const debugConfig = { ...config, enableDebugMode: true };
      const debugReporter = new ErrorReporter("DebugEvent", debugConfig);

      const debugData = { step: 1, status: "active" };
      debugReporter.reportDebugInfo("Processing step", debugData);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Event DebugEvent: Processing step"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith("Debug data:", debugData);
    });

    test("应该在非调试模式下不报告性能警告", () => {
      errorReporter.reportPerformanceWarning("Performance issue");

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test("应该在非调试模式下不报告调试信息", () => {
      errorReporter.reportDebugInfo("Debug message");

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe("默认Logger处理", () => {
    test("应该在没有配置Logger时使用默认Logger", () => {
      const configWithoutLogger = { ...config };
      delete configWithoutLogger.logger;

      const defaultLoggerReporter = new ErrorReporter(
        "DefaultEvent",
        configWithoutLogger
      );

      // 这应该不会抛出错误，因为会使用默认logger
      expect(() => {
        defaultLoggerReporter.reportErrors([
          { index: 0, error: new Error("Test") },
        ]);
      }).not.toThrow();
    });

    test("应该处理Logger缺少debug方法的情况", () => {
      const incompleteLogger: Partial<Logger> = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        // 缺少debug方法
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

      // 应该不会抛出错误，即使logger没有debug方法
      expect(() => {
        incompleteReporter.reportDebugInfo("Test debug");
      }).not.toThrow();
    });
  });

  describe("边界情况", () => {
    test("应该处理不同并发模式", () => {
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

    test("应该处理各种错误类型", () => {
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

    test("应该处理极大的索引值", () => {
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
