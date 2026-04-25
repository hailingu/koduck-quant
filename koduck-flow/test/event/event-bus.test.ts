import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EventBus,
  LoggingEvent,
  SystemEventBus,
  createEventBus,
} from "../../src/common/event/event-bus";
import { BaseEvent } from "../../src/common/event/base-event";
import { GenericEvent } from "../../src/common/event/generic-event";

describe("EventBus Event System", () => {
  describe("LoggingEvent", () => {
    let loggingEvent: LoggingEvent;

    beforeEach(() => {
      loggingEvent = new LoggingEvent();
    });

    afterEach(() => {
      loggingEvent.dispose();
    });

    test("应该正确初始化日志事件", () => {
      expect(loggingEvent).toBeInstanceOf(BaseEvent);
      // 测试事件名称通过构造函数参数传递
    });

    test("应该正确配置批处理", () => {
      const config = loggingEvent.configuration;
      expect(config.enableBatching).toBe(true);
      expect(config.batchSize).toBe(50);
      expect(config.batchInterval).toBe(500);
    });

    test("应该正确记录debug日志", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      loggingEvent.debug("Debug message", { user: "test" }, "test-source");

      expect(listener).toHaveBeenCalledWith({
        level: "debug",
        message: "Debug message",
        error: undefined,
        context: { user: "test" },
        timestamp: expect.any(Number),
        source: "test-source",
      });
    });

    test("应该正确记录info日志", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      loggingEvent.info("Info message", { module: "test" });

      expect(listener).toHaveBeenCalledWith({
        level: "info",
        message: "Info message",
        error: undefined,
        context: { module: "test" },
        timestamp: expect.any(Number),
        source: undefined,
      });
    });

    test("应该正确记录warn日志", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      loggingEvent.warn("Warning message");

      expect(listener).toHaveBeenCalledWith({
        level: "warn",
        message: "Warning message",
        error: undefined,
        context: undefined,
        timestamp: expect.any(Number),
        source: undefined,
      });
    });

    test("应该正确记录error日志", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      const error = new Error("Critical error");
      loggingEvent.error(
        "Error message",
        error,
        { severity: "high" },
        "error-source"
      );

      expect(listener).toHaveBeenCalledWith({
        level: "error",
        message: "Error message",
        error,
        context: { severity: "high" },
        timestamp: expect.any(Number),
        source: "error-source",
      });
    });

    test("应该正确记录fatal日志", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      const fatalError = new Error("Fatal error");
      loggingEvent.fatal(
        "Fatal message",
        fatalError,
        { critical: true },
        "fatal-source"
      );

      expect(listener).toHaveBeenCalledWith({
        level: "fatal",
        message: "Fatal message",
        error: fatalError,
        context: { critical: true },
        timestamp: expect.any(Number),
        source: "fatal-source",
      });
    });

    test("应该支持所有日志级别", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      // 手动调用各个日志方法
      loggingEvent.debug("debug message");
      loggingEvent.info("info message");
      loggingEvent.warn("warn message");
      loggingEvent.error("error message");
      loggingEvent.fatal("fatal message");

      expect(listener).toHaveBeenCalledTimes(5);
      const levels = ["debug", "info", "warn", "error", "fatal"] as const;
      levels.forEach((level, index) => {
        expect(listener).toHaveBeenNthCalledWith(
          index + 1,
          expect.objectContaining({
            level,
            message: `${level} message`,
          })
        );
      });
    });
  });

  describe("SystemEventBus", () => {
    let systemEventBus: SystemEventBus;

    beforeEach(() => {
      systemEventBus = new SystemEventBus();
    });

    afterEach(() => {
      systemEventBus.dispose();
    });

    test("应该正确初始化系统事件总线", () => {
      expect(systemEventBus).toBeInstanceOf(BaseEvent);
      // 系统事件总线继承自BaseEvent
    });

    test("应该禁用批处理", () => {
      const config = systemEventBus.configuration;
      expect(config.enableBatching).toBe(false);
    });

    test("应该正确触发startup事件", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { version: "1.0.0" };
      systemEventBus.startup(data, "app");

      expect(listener).toHaveBeenCalledWith({
        type: "startup",
        data,
        timestamp: expect.any(Number),
        source: "app",
      });
    });

    test("应该正确触发shutdown事件", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { graceful: true };
      systemEventBus.shutdown(data, "app");

      expect(listener).toHaveBeenCalledWith({
        type: "shutdown",
        data,
        timestamp: expect.any(Number),
        source: "app",
      });
    });

    test("应该正确触发systemError事件", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { errorCode: 500 };
      systemEventBus.systemError(data, "server");

      expect(listener).toHaveBeenCalledWith({
        type: "error",
        data,
        timestamp: expect.any(Number),
        source: "server",
      });
    });

    test("应该正确触发systemWarning事件", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { memory: "high" };
      systemEventBus.systemWarning(data, "monitor");

      expect(listener).toHaveBeenCalledWith({
        type: "warning",
        data,
        timestamp: expect.any(Number),
        source: "monitor",
      });
    });

    test("应该正确触发configChange事件", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { key: "debug", value: true };
      systemEventBus.configChange(data, "config-manager");

      expect(listener).toHaveBeenCalledWith({
        type: "config-change",
        data,
        timestamp: expect.any(Number),
        source: "config-manager",
      });
    });

    test("应该支持所有系统事件类型", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      // 手动调用各个系统事件方法
      systemEventBus.startup({ test: true }, "test-source");
      systemEventBus.shutdown({ test: true }, "test-source");
      systemEventBus.systemError({ test: true }, "test-source");
      systemEventBus.systemWarning({ test: true }, "test-source");
      systemEventBus.configChange({ test: true }, "test-source");

      expect(listener).toHaveBeenCalledTimes(5);

      const eventTypes = [
        "startup",
        "shutdown",
        "error",
        "warning",
        "config-change",
      ];
      eventTypes.forEach((expectedType, index) => {
        expect(listener).toHaveBeenNthCalledWith(
          index + 1,
          expect.objectContaining({
            type: expectedType,
            source: "test-source",
          })
        );
      });
    });
  });

  describe("EventBus 实例", () => {
    test("工厂函数应该创建 EventBus 实例", () => {
      const factoryInstance = createEventBus();

      expect(factoryInstance).toBeInstanceOf(EventBus);
      expect(factoryInstance.logging).toBeInstanceOf(LoggingEvent);
      expect(factoryInstance.system).toBeInstanceOf(SystemEventBus);

      factoryInstance.dispose();
    });

    test("构造函数应该创建独立实例", () => {
      const instance1 = new EventBus();
      const instance2 = new EventBus();

      expect(instance1).not.toBe(instance2);
      expect(instance1.logging).toBeInstanceOf(LoggingEvent);
      expect(instance2.system).toBeInstanceOf(SystemEventBus);

      instance1.dispose();
      instance2.dispose();
    });
  });

  describe("EventBus Debug Mode", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("应该为所有事件设置调试模式", () => {
      const setDebugModeSpy = vi.spyOn(eventBus.logging, "setDebugMode");
      const systemSetDebugModeSpy = vi.spyOn(eventBus.system, "setDebugMode");

      eventBus.setDebugMode(true);

      expect(setDebugModeSpy).toHaveBeenCalledWith(true);
      expect(systemSetDebugModeSpy).toHaveBeenCalledWith(true);
    });

    test("应该返回自身以支持链式调用", () => {
      const result = eventBus.setDebugMode(true);
      expect(result).toBe(eventBus);
    });
  });

  describe("EventBus Configuration", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("应该为所有事件配置参数", () => {
      const config = { enableBatching: false, batchSize: 10 };
      const updateConfigSpy = vi.spyOn(eventBus.logging, "updateConfiguration");
      const systemUpdateConfigSpy = vi.spyOn(
        eventBus.system,
        "updateConfiguration"
      );

      eventBus.configureAll(config);

      expect(updateConfigSpy).toHaveBeenCalledWith(config);
      expect(systemUpdateConfigSpy).toHaveBeenCalledWith(config);
    });

    test("应该返回自身以支持链式调用", () => {
      const result = eventBus.configureAll({ enableBatching: false });
      expect(result).toBe(eventBus);
    });
  });

  describe("EventBus Batch Management", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("应该刷新所有事件的批次", () => {
      const flushBatchSpy = vi.spyOn(eventBus.logging, "flushBatch");
      const systemFlushBatchSpy = vi.spyOn(eventBus.system, "flushBatch");

      eventBus.flushAllBatches();

      expect(flushBatchSpy).toHaveBeenCalled();
      expect(systemFlushBatchSpy).toHaveBeenCalled();
    });
  });

  describe("EventBus Cleanup", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("应该清除所有事件监听器", () => {
      const clearSpy = vi.spyOn(eventBus.logging, "clear");
      const systemClearSpy = vi.spyOn(eventBus.system, "clear");

      eventBus.clearAll();

      expect(clearSpy).toHaveBeenCalled();
      expect(systemClearSpy).toHaveBeenCalled();
    });

    test("应该重置所有事件", () => {
      const resetSpy = vi.spyOn(eventBus.logging, "reset");
      const systemResetSpy = vi.spyOn(eventBus.system, "reset");

      eventBus.resetAll();

      expect(resetSpy).toHaveBeenCalled();
      expect(systemResetSpy).toHaveBeenCalled();
    });

    test("应该释放所有事件资源", () => {
      const disposeSpy = vi.spyOn(eventBus.logging, "dispose");
      const systemDisposeSpy = vi.spyOn(eventBus.system, "dispose");

      eventBus.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(systemDisposeSpy).toHaveBeenCalled();
    });
  });

  describe("EventBus Statistics", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("应该返回统计信息", () => {
      const stats = eventBus.getAllStats();

      expect(stats).toEqual({
        managerType: "EventBus",
        timestamp: expect.any(Number),
        message: "统计功能已移除",
      });
    });
  });

  describe("EventBus Custom Events", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("应该注册自定义事件", () => {
      const customEvent = new GenericEvent<string>("test-event");
      eventBus.registerEvent("test", customEvent);

      const retrievedEvent = eventBus.getEvent<string>("test");
      expect(retrievedEvent).toBe(customEvent);
    });

    test("应该注销自定义事件", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const disposeSpy = vi.spyOn(customEvent, "dispose");

      eventBus.registerEvent("test", customEvent);
      const result = eventBus.unregisterEvent("test");

      expect(result).toBe(true);
      expect(disposeSpy).toHaveBeenCalled();
      expect(eventBus.getEvent("test")).toBeUndefined();
    });

    test("应该处理注销不存在的事件", () => {
      const result = eventBus.unregisterEvent("non-existent");
      expect(result).toBe(false);
    });

    test("应该获取不存在的自定义事件返回undefined", () => {
      const event = eventBus.getEvent("non-existent");
      expect(event).toBeUndefined();
    });
  });

  describe("EventBus Compatibility Methods", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("应该支持on方法监听事件", () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on<string>("test-event", listener);

      expect(typeof unsubscribe).toBe("function");

      // 验证事件已自动创建
      const event = eventBus.getEvent<string>("test-event");
      expect(event).toBeInstanceOf(GenericEvent);
    });

    test("应该支持off方法移除监听器", () => {
      const listener = vi.fn();
      eventBus.on<string>("test-event", listener);

      const result = eventBus.off<string>("test-event", listener);
      expect(result).toBe(true);
    });

    test("应该处理移除不存在事件的监听器", () => {
      const listener = vi.fn();
      const result = eventBus.off<string>("non-existent", listener);
      expect(result).toBe(false);
    });

    test("应该支持emit方法触发事件", () => {
      const listener = vi.fn();
      eventBus.on<string>("test-event", listener);

      eventBus.emit<string>("test-event", "test payload");

      expect(listener).toHaveBeenCalledWith("test payload");
    });

    test("应该处理触发不存在的事件", () => {
      // 不应该抛出错误
      expect(() => {
        eventBus.emit<string>("non-existent", "test");
      }).not.toThrow();
    });

    test("应该为自定义事件设置调试模式", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const setDebugModeSpy = vi.spyOn(customEvent, "setDebugMode");

      eventBus.registerEvent("test", customEvent);
      eventBus.setDebugMode(true);

      expect(setDebugModeSpy).toHaveBeenCalledWith(true);
    });

    test("应该为自定义事件配置参数", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const updateConfigSpy = vi.spyOn(customEvent, "updateConfiguration");
      const config = { enableBatching: false };

      eventBus.registerEvent("test", customEvent);
      eventBus.configureAll(config);

      expect(updateConfigSpy).toHaveBeenCalledWith(config);
    });

    test("应该刷新自定义事件批次", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const flushBatchSpy = vi.spyOn(customEvent, "flushBatch");

      eventBus.registerEvent("test", customEvent);
      eventBus.flushAllBatches();

      expect(flushBatchSpy).toHaveBeenCalled();
    });

    test("应该清除自定义事件监听器", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const clearSpy = vi.spyOn(customEvent, "clear");

      eventBus.registerEvent("test", customEvent);
      eventBus.clearAll();

      expect(clearSpy).toHaveBeenCalled();
    });

    test("应该重置自定义事件", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const resetSpy = vi.spyOn(customEvent, "reset");

      eventBus.registerEvent("test", customEvent);
      eventBus.resetAll();

      expect(resetSpy).toHaveBeenCalled();
    });

    test("应该释放自定义事件资源", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const disposeSpy = vi.spyOn(customEvent, "dispose");

      eventBus.registerEvent("test", customEvent);
      eventBus.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe("EventBus Integration", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("应该支持完整的事件生命周期", () => {
      // 日志事件测试
      const logListener = vi.fn();
      eventBus.logging.addEventListener(logListener);
      eventBus.logging.info("Test log message");

      expect(logListener).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          message: "Test log message",
        })
      );

      // 系统事件测试
      const systemListener = vi.fn();
      eventBus.system.addEventListener(systemListener);
      eventBus.system.startup({ version: "1.0" }, "app");

      expect(systemListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "startup",
          data: { version: "1.0" },
          source: "app",
        })
      );

      // 自定义事件测试
      const customListener = vi.fn();
      eventBus.on<number>("custom-event", customListener);
      eventBus.emit<number>("custom-event", 42);

      expect(customListener).toHaveBeenCalledWith(42);
    });

    test("应该正确处理混合事件操作", () => {
      // 注册多个事件
      const event1 = new GenericEvent<string>("event1");
      const event2 = new GenericEvent<number>("event2");

      eventBus.registerEvent("test1", event1);
      eventBus.registerEvent("test2", event2);

      // 设置调试模式
      eventBus.setDebugMode(true);

      // 配置所有事件
      eventBus.configureAll({ enableBatching: false });

      // 刷新批次
      eventBus.flushAllBatches();

      // 清理所有资源
      eventBus.clearAll();
      eventBus.resetAll();

      // 验证事件仍然存在但已清理
      expect(eventBus.getEvent("test1")).toBe(event1);
      expect(eventBus.getEvent("test2")).toBe(event2);
    });
  });
});
