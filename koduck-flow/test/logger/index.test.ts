import { describe, test, expect } from "vitest";
import { logger, getLoggerCore, noopMinimalLogger } from "../../src/common/logger/index";
import type { LogLevel, LogConfig, LoggerCore } from "../../src/common/logger/index";

describe("Logger Index Exports", () => {
  describe("Exported Instances", () => {
    test("should export logger instance", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.setConfig).toBe("function");
    });

    test("should export getLoggerCore function", () => {
      expect(getLoggerCore).toBeDefined();
      expect(typeof getLoggerCore).toBe("function");

      const core = getLoggerCore();
      expect(core).toBeDefined();
      expect(typeof core.warn).toBe("function");
      expect(typeof core.error).toBe("function");
    });

    test("should export noopMinimalLogger instance", () => {
      expect(noopMinimalLogger).toBeDefined();
      expect(typeof noopMinimalLogger.warn).toBe("function");
      expect(typeof noopMinimalLogger.error).toBe("function");
      expect(typeof noopMinimalLogger.debug).toBe("function");
      expect(typeof noopMinimalLogger.info).toBe("function");
    });
  });

  describe("Type Exports", () => {
    test("should correctly export LogLevel type", () => {
      const level: LogLevel = "debug";
      expect(level).toBe("debug");
    });

    test("should correctly export LogConfig type", () => {
      const config: LogConfig = {
        enabled: true,
        level: "info",
        prefix: "[Test]",
      };

      expect(config.enabled).toBe(true);
      expect(config.level).toBe("info");
      expect(config.prefix).toBe("[Test]");
    });

    test("should correctly export LoggerCore type", () => {
      const core: LoggerCore = {
        warn: () => {},
        error: () => {},
      };

      expect(typeof core.warn).toBe("function");
      expect(typeof core.error).toBe("function");
    });
  });

  describe("Module Consistency", () => {
    test("noopMinimalLogger should conform to LoggerCore interface", () => {
      const noop: LoggerCore = noopMinimalLogger;

      expect(typeof noop.warn).toBe("function");
      expect(typeof noop.error).toBe("function");
      expect(typeof noop.debug).toBe("function");
      expect(typeof noop.info).toBe("function");
    });
  });
});
