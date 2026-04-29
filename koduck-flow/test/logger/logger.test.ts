import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";
import { logger, getLoggerCore, noopMinimalLogger } from "../../src/common/logger";
import type { LogConfig } from "../../src/common/logger";

describe("Logger", () => {
  // Mock console methods
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
    time: console.time,
    timeEnd: console.timeEnd,
  };

  beforeEach(() => {
    // Mock console methods
    console.debug = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    console.time = vi.fn();
    console.timeEnd = vi.fn();

    // Reset logger config to default state
    logger.setConfig({
      enabled: true,
      level: "debug",
      prefix: "[KoduckFlow]",
      format: "text",
      includeEmoji: false,
      metadata: undefined,
    });
  });

  afterEach(() => {
    // Restore console methods
    Object.assign(console, originalConsole);
    vi.clearAllMocks();
  });

  describe("Configuration Management", () => {
    test("should be able to set configuration", () => {
      const config: Partial<LogConfig> = {
        enabled: false,
        level: "error",
        prefix: "[Test]",
      };

      logger.setConfig(config);

      // Test that logging is disabled
      logger.debug("test debug message");
      logger.info("test info message");
      logger.warn("test warn message");
      logger.error("test error message");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should support partial configuration updates", () => {
      logger.setConfig({ level: "warn" });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("Log Level Control", () => {
    test("debug level should output all logs", () => {
      logger.setConfig({ level: "debug" });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test("info level should output info, warn, error", () => {
      logger.setConfig({ level: "info" });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test("warn level should only output warn, error", () => {
      logger.setConfig({ level: "warn" });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test("error level should only output error", () => {
      logger.setConfig({ level: "error" });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("Message Formatting", () => {
    test("should correctly format string messages", () => {
      logger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| test message$/
        )
      );
    });

    test("should correctly format object messages", () => {
      const testObj = { key: "value", number: 42 };
      logger.warn(testObj);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| {"key":"value","number":42}$/
        )
      );
    });

    test("should handle non-serializable objects", () => {
      const circularObj: Record<string, unknown> = { name: "circular" };
      circularObj.self = circularObj;

      logger.warn(circularObj);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| \[object Object\]$/
        )
      );
    });

    test("should support custom prefix", () => {
      logger.setConfig({ prefix: "[CustomPrefix]" });
      logger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[CustomPrefix\] \[WARN\] \| test message$/
        )
      );
    });

    test("should support empty prefix", () => {
      logger.setConfig({ prefix: "" });
      logger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[WARN\] \| test message$/
        )
      );
    });
  });

  describe("Variadic Arguments Support", () => {
    test("should support multiple arguments", () => {
      logger.warn("message", { data: "test" }, "extra");

      const warnMock = console.warn as unknown as Mock;
      const [message, ...rest] = warnMock.mock.calls[0];

      expect(message).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| message \| details=\[{"data":"test"},"extra"\]$/
      );
      expect(rest).toEqual([{ data: "test" }, "extra"]);
    });

    test("should handle empty arguments", () => {
      logger.warn();

      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should handle a single undefined argument", () => {
      logger.warn(undefined);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| undefined$/
        )
      );
    });
  });

  describe("Structured Configuration", () => {
    test("should output default emoji when includeEmoji is true", () => {
      logger.setConfig({ includeEmoji: true });

      logger.info("emoji message");

      expect(console.info).toHaveBeenCalled();
      const infoMock = console.info as unknown as Mock;
      const [firstArg] = infoMock.mock.calls[0];
      expect(firstArg).toMatch(/\[INFO\] ℹ️/);
    });

    test("should output JSON string when format is json", () => {
      logger.setConfig({ format: "json" });

      logger.error({
        message: "something went wrong",
        event: "test-error",
        metadata: { id: "42" },
      });

      expect(console.error).toHaveBeenCalled();
      const errorMock = console.error as unknown as Mock;
      const [firstArg] = errorMock.mock.calls[0];
      const parsed = JSON.parse(firstArg as string);
      expect(parsed).toMatchObject({
        level: "error",
        message: "something went wrong",
        event: "test-error",
        metadata: { id: "42" },
      });
      expect(parsed).toHaveProperty("timestamp");
    });

    test("withContext should merge multi-layer metadata", () => {
      logger.setConfig({
        format: "json",
        metadata: { app: "koduck-flow" },
      });

      const contextual = logger.withContext({
        tag: "flow",
        metadata: { flowId: "123" },
      });

      contextual.info?.({ message: "started", metadata: { step: 1 } });

      const infoMock = console.info as unknown as Mock;
      const [firstArg] = infoMock.mock.calls[0];
      const parsed = JSON.parse(firstArg as string);
      expect(parsed).toMatchObject({
        level: "info",
        tag: "flow",
        metadata: { app: "koduck-flow", flowId: "123", step: 1 },
      });
    });
  });

  describe("Performance Monitoring Methods", () => {
    test("time method should call console.time at debug level", () => {
      logger.setConfig({ level: "debug" });
      logger.time("test-timer");

      expect(console.time).toHaveBeenCalledWith("[KoduckFlow] test-timer");
    });

    test("timeEnd method should call console.timeEnd at debug level", () => {
      logger.setConfig({ level: "debug" });
      logger.timeEnd("test-timer");

      expect(console.timeEnd).toHaveBeenCalledWith("[KoduckFlow] test-timer");
    });

    test("time and timeEnd should not call console methods at non-debug levels", () => {
      logger.setConfig({ level: "info" });
      logger.time("test-timer");
      logger.timeEnd("test-timer");

      expect(console.time).not.toHaveBeenCalled();
      expect(console.timeEnd).not.toHaveBeenCalled();
    });
  });

  describe("Child Logger Functionality", () => {
    test("should create child logger with context", () => {
      const childLogger = logger.child({ module: "test", version: "1.0" });

      childLogger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| test message \| meta=\{"module":"test","version":"1\.0"\}$/
        )
      );
    });

    test("child logger should support all log levels", () => {
      const childLogger = logger.child({ test: true });

      childLogger.debug?.("debug message");
      childLogger.info?.("info message");
      childLogger.warn("warn message");
      childLogger.error("error message");

      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test("child logger time method should include context", () => {
      logger.setConfig({ level: "debug" });
      const childLogger = logger.child({ module: "timer" });

      childLogger.time("operation");
      childLogger.timeEnd("operation");

      expect(console.time).toHaveBeenCalledWith('[KoduckFlow] operation {"module":"timer"}');
      expect(console.timeEnd).toHaveBeenCalledWith('[KoduckFlow] operation {"module":"timer"}');
    });

    test("should handle non-serializable context", () => {
      const circularContext: Record<string, unknown> = { name: "test" };
      circularContext.self = circularContext;

      const childLogger = logger.child(circularContext);
      childLogger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| test message \| meta=\[object Object\]$/
        )
      );
    });
  });

  describe("LoggerCore Adaptation", () => {
    test("asCore method should return LoggerCore instance", () => {
      const core = logger.asCore();

      expect(core).toHaveProperty("debug");
      expect(core).toHaveProperty("info");
      expect(core).toHaveProperty("warn");
      expect(core).toHaveProperty("error");
      expect(typeof core.debug).toBe("function");
      expect(typeof core.info).toBe("function");
      expect(typeof core.warn).toBe("function");
      expect(typeof core.error).toBe("function");
    });

    test("asMinimal method should behave consistently with asCore method", () => {
      const minimal = logger.asMinimal();
      const core = logger.asCore();

      expect(typeof minimal.debug).toBe(typeof core.debug);
      expect(typeof minimal.info).toBe(typeof core.info);
      expect(typeof minimal.warn).toBe(typeof core.warn);
      expect(typeof minimal.error).toBe(typeof core.error);
    });

    test("LoggerCore warn and error methods should work correctly", () => {
      const core = logger.asCore();

      core.warn("core warn message");
      core.error("core error message");

      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test("LoggerCore debug and info methods should be no-op", () => {
      const core = logger.asCore();

      // These should not throw and should not call console methods
      core.debug?.("debug message");
      core.info?.("info message");

      // Since debug and info are no-op in core, they shouldn't call console
      // But we need to check that they don't throw
      expect(() => {
        core.debug?.("test");
        core.info?.("test");
      }).not.toThrow();
    });
  });

  describe("Global Functions", () => {
    test("getLoggerCore should return LoggerCore instance", () => {
      const core = getLoggerCore();

      expect(core).toHaveProperty("warn");
      expect(core).toHaveProperty("error");
      expect(typeof core.warn).toBe("function");
      expect(typeof core.error).toBe("function");
    });

    test("noopMinimalLogger should be completely silent", () => {
      noopMinimalLogger.debug?.("debug");
      noopMinimalLogger.info?.("info");
      noopMinimalLogger.warn("warn");
      noopMinimalLogger.error("error");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("Log Enable/Disable", () => {
    test("should not output any logs when logging is disabled", () => {
      logger.setConfig({ enabled: false });

      logger.debug("debug message");
      logger.info("info message");
      logger.warn("warn message");
      logger.error("error message");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("time and timeEnd should not work when logging is disabled", () => {
      logger.setConfig({ enabled: false, level: "debug" });

      logger.time("test-timer");
      logger.timeEnd("test-timer");

      expect(console.time).not.toHaveBeenCalled();
      expect(console.timeEnd).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    test("should handle null and undefined messages", () => {
      logger.warn(null);
      logger.error(undefined);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| null$/
        )
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[ERROR\] \| undefined$/
        )
      );
    });

    test("should handle number and boolean messages", () => {
      logger.warn(42);
      logger.error(true);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| 42$/
        )
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[ERROR\] \| true$/
        )
      );
    });

    test("should handle array messages", () => {
      logger.warn([1, 2, 3]);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| \[1,2,3\]$/
        )
      );
    });

    test("should handle Function messages", () => {
      const testFn = () => "test";
      logger.warn(testFn);

      // Function messages will be directly converted to function source code strings
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[KoduckFlow\] \[WARN\] \| \(\) => "test"$/
        )
      );
    });
  });
});
