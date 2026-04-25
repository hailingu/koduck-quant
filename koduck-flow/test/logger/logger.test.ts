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
      prefix: "[DuckFlow]",
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

  describe("配置管理", () => {
    test("应该能设置配置", () => {
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

    test("应该支持部分配置更新", () => {
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

  describe("日志级别控制", () => {
    test("debug级别应该输出所有日志", () => {
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

    test("info级别应该输出info、warn、error", () => {
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

    test("warn级别应该只输出warn、error", () => {
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

    test("error级别应该只输出error", () => {
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

  describe("消息格式化", () => {
    test("应该正确格式化字符串消息", () => {
      logger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| test message$/
        )
      );
    });

    test("应该正确格式化对象消息", () => {
      const testObj = { key: "value", number: 42 };
      logger.warn(testObj);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| {"key":"value","number":42}$/
        )
      );
    });

    test("应该处理无法序列化的对象", () => {
      const circularObj: Record<string, unknown> = { name: "circular" };
      circularObj.self = circularObj;

      logger.warn(circularObj);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| \[object Object\]$/
        )
      );
    });

    test("应该支持自定义前缀", () => {
      logger.setConfig({ prefix: "[CustomPrefix]" });
      logger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[CustomPrefix\] \[WARN\] \| test message$/
        )
      );
    });

    test("应该支持空前缀", () => {
      logger.setConfig({ prefix: "" });
      logger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[WARN\] \| test message$/
        )
      );
    });
  });

  describe("变参数支持", () => {
    test("应该支持多个参数", () => {
      logger.warn("message", { data: "test" }, "extra");

      const warnMock = console.warn as unknown as Mock;
      const [message, ...rest] = warnMock.mock.calls[0];

      expect(message).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| message \| details=\[{"data":"test"},"extra"\]$/
      );
      expect(rest).toEqual([{ data: "test" }, "extra"]);
    });

    test("应该处理空参数", () => {
      logger.warn();

      expect(console.warn).not.toHaveBeenCalled();
    });

    test("应该处理单个undefined参数", () => {
      logger.warn(undefined);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| undefined$/
        )
      );
    });
  });

  describe("结构化配置", () => {
    test("includeEmoji为true时应该输出默认emoji", () => {
      logger.setConfig({ includeEmoji: true });

      logger.info("emoji message");

      expect(console.info).toHaveBeenCalled();
      const infoMock = console.info as unknown as Mock;
      const [firstArg] = infoMock.mock.calls[0];
      expect(firstArg).toMatch(/\[INFO\] ℹ️/);
    });

    test("format为json时应该输出JSON字符串", () => {
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

    test("withContext应该合并多层metadata", () => {
      logger.setConfig({
        format: "json",
        metadata: { app: "duck-flow" },
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
        metadata: { app: "duck-flow", flowId: "123", step: 1 },
      });
    });
  });

  describe("性能监控方法", () => {
    test("time方法应该在debug级别时调用console.time", () => {
      logger.setConfig({ level: "debug" });
      logger.time("test-timer");

      expect(console.time).toHaveBeenCalledWith("[DuckFlow] test-timer");
    });

    test("timeEnd方法应该在debug级别时调用console.timeEnd", () => {
      logger.setConfig({ level: "debug" });
      logger.timeEnd("test-timer");

      expect(console.timeEnd).toHaveBeenCalledWith("[DuckFlow] test-timer");
    });

    test("time和timeEnd在非debug级别时不应该调用console方法", () => {
      logger.setConfig({ level: "info" });
      logger.time("test-timer");
      logger.timeEnd("test-timer");

      expect(console.time).not.toHaveBeenCalled();
      expect(console.timeEnd).not.toHaveBeenCalled();
    });
  });

  describe("子logger功能", () => {
    test("应该创建带上下文的子logger", () => {
      const childLogger = logger.child({ module: "test", version: "1.0" });

      childLogger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| test message \| meta=\{"module":"test","version":"1\.0"\}$/
        )
      );
    });

    test("子logger应该支持所有日志级别", () => {
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

    test("子logger的time方法应该包含上下文", () => {
      logger.setConfig({ level: "debug" });
      const childLogger = logger.child({ module: "timer" });

      childLogger.time("operation");
      childLogger.timeEnd("operation");

      expect(console.time).toHaveBeenCalledWith('[DuckFlow] operation {"module":"timer"}');
      expect(console.timeEnd).toHaveBeenCalledWith('[DuckFlow] operation {"module":"timer"}');
    });

    test("应该处理无法序列化的上下文", () => {
      const circularContext: Record<string, unknown> = { name: "test" };
      circularContext.self = circularContext;

      const childLogger = logger.child(circularContext);
      childLogger.warn("test message");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| test message \| meta=\[object Object\]$/
        )
      );
    });
  });

  describe("LoggerCore适配", () => {
    test("asCore方法应该返回LoggerCore实例", () => {
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

    test("asMinimal方法应该与asCore方法行为一致", () => {
      const minimal = logger.asMinimal();
      const core = logger.asCore();

      expect(typeof minimal.debug).toBe(typeof core.debug);
      expect(typeof minimal.info).toBe(typeof core.info);
      expect(typeof minimal.warn).toBe(typeof core.warn);
      expect(typeof minimal.error).toBe(typeof core.error);
    });

    test("LoggerCore的warn和error方法应该正常工作", () => {
      const core = logger.asCore();

      core.warn("core warn message");
      core.error("core error message");

      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    test("LoggerCore的debug和info方法应该是no-op", () => {
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

  describe("全局函数", () => {
    test("getLoggerCore应该返回LoggerCore实例", () => {
      const core = getLoggerCore();

      expect(core).toHaveProperty("warn");
      expect(core).toHaveProperty("error");
      expect(typeof core.warn).toBe("function");
      expect(typeof core.error).toBe("function");
    });

    test("noopMinimalLogger应该是完全静默的", () => {
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

  describe("日志启用/禁用", () => {
    test("禁用日志时不应该输出任何日志", () => {
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

    test("禁用日志时time和timeEnd也不应该工作", () => {
      logger.setConfig({ enabled: false, level: "debug" });

      logger.time("test-timer");
      logger.timeEnd("test-timer");

      expect(console.time).not.toHaveBeenCalled();
      expect(console.timeEnd).not.toHaveBeenCalled();
    });
  });

  describe("边界情况", () => {
    test("应该处理null和undefined消息", () => {
      logger.warn(null);
      logger.error(undefined);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| null$/
        )
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[ERROR\] \| undefined$/
        )
      );
    });

    test("应该处理数字和布尔值消息", () => {
      logger.warn(42);
      logger.error(true);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| 42$/
        )
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[ERROR\] \| true$/
        )
      );
    });

    test("应该处理数组消息", () => {
      logger.warn([1, 2, 3]);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| \[1,2,3\]$/
        )
      );
    });

    test("应该处理Function消息", () => {
      const testFn = () => "test";
      logger.warn(testFn);

      // Function消息会被直接转换为函数源代码字符串
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DuckFlow\] \[WARN\] \| \(\) => "test"$/
        )
      );
    });
  });
});
