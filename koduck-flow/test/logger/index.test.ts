import { describe, test, expect } from "vitest";
import { logger, getLoggerCore, noopMinimalLogger } from "../../src/common/logger/index";
import type { LogLevel, LogConfig, LoggerCore } from "../../src/common/logger/index";

describe("Logger Index Exports", () => {
  describe("导出的实例", () => {
    test("应该导出logger实例", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.setConfig).toBe("function");
    });

    test("应该导出getLoggerCore函数", () => {
      expect(getLoggerCore).toBeDefined();
      expect(typeof getLoggerCore).toBe("function");

      const core = getLoggerCore();
      expect(core).toBeDefined();
      expect(typeof core.warn).toBe("function");
      expect(typeof core.error).toBe("function");
    });

    test("应该导出noopMinimalLogger实例", () => {
      expect(noopMinimalLogger).toBeDefined();
      expect(typeof noopMinimalLogger.warn).toBe("function");
      expect(typeof noopMinimalLogger.error).toBe("function");
      expect(typeof noopMinimalLogger.debug).toBe("function");
      expect(typeof noopMinimalLogger.info).toBe("function");
    });
  });

  describe("类型导出", () => {
    test("应该正确导出LogLevel类型", () => {
      const level: LogLevel = "debug";
      expect(level).toBe("debug");
    });

    test("应该正确导出LogConfig类型", () => {
      const config: LogConfig = {
        enabled: true,
        level: "info",
        prefix: "[Test]",
      };

      expect(config.enabled).toBe(true);
      expect(config.level).toBe("info");
      expect(config.prefix).toBe("[Test]");
    });

    test("应该正确导出LoggerCore类型", () => {
      const core: LoggerCore = {
        warn: () => {},
        error: () => {},
      };

      expect(typeof core.warn).toBe("function");
      expect(typeof core.error).toBe("function");
    });
  });

  describe("模块一致性", () => {
    test("noopMinimalLogger应该符合LoggerCore接口", () => {
      const noop: LoggerCore = noopMinimalLogger;

      expect(typeof noop.warn).toBe("function");
      expect(typeof noop.error).toBe("function");
      expect(typeof noop.debug).toBe("function");
      expect(typeof noop.info).toBe("function");
    });
  });
});
