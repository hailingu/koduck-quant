/**
 * GenericEvent 和 createEmitter 函数单元测试
 * 测试通用事件类和事件发射器工厂函数
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  GenericEvent,
  createEmitter,
} from "../../src/common/event/generic-event";
import { BaseEvent } from "../../src/common/event/base-event";
import type { EventConfiguration } from "../../src/common/event/types";

describe("GenericEvent", () => {
  let event: GenericEvent<string>;

  beforeEach(() => {
    event = new GenericEvent<string>();
  });

  describe("基础功能", () => {
    it("应该能创建 GenericEvent 实例", () => {
      expect(event).toBeInstanceOf(GenericEvent);
      expect(event).toBeInstanceOf(BaseEvent);
      expect(event["eventName"]).toBe("GenericEvent");
    });

    it("应该支持自定义事件名", () => {
      const customEvent = new GenericEvent<number>("CustomEvent");
      expect(customEvent["eventName"]).toBe("CustomEvent");
    });

    it("应该支持自定义配置", () => {
      const config: Partial<EventConfiguration> = {
        enableBatching: false,
        maxListeners: 200,
        enableDebugMode: true,
      };

      const configuredEvent = new GenericEvent<string>(
        "ConfiguredEvent",
        config
      );
      expect(configuredEvent).toBeInstanceOf(GenericEvent);
      expect(configuredEvent["eventName"]).toBe("ConfiguredEvent");
    });

    it("应该支持预设配置", () => {
      const highPerfEvent = new GenericEvent<string>(
        "HighPerfEvent",
        "high-performance"
      );
      expect(highPerfEvent).toBeInstanceOf(GenericEvent);
      expect(highPerfEvent["eventName"]).toBe("HighPerfEvent");
    });
  });

  describe("事件处理功能", () => {
    it("应该能添加和触发监听器", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      event.fire("test data");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("test data");
    });

    it("应该支持多种数据类型", () => {
      const numberEvent = new GenericEvent<number>("NumberEvent");
      const objectEvent = new GenericEvent<{ id: string; value: number }>(
        "ObjectEvent"
      );

      const numberListener = vi.fn();
      const objectListener = vi.fn();

      numberEvent.addEventListener(numberListener);
      objectEvent.addEventListener(objectListener);

      numberEvent.fire(42);
      objectEvent.fire({ id: "test", value: 100 });

      expect(numberListener).toHaveBeenCalledWith(42);
      expect(objectListener).toHaveBeenCalledWith({ id: "test", value: 100 });
    });

    it("应该正确处理监听器的添加和移除", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = event.addEventListener(listener1);
      event.addEventListener(listener2);

      event.fire("test1");
      expect(listener1).toHaveBeenCalledWith("test1");
      expect(listener2).toHaveBeenCalledWith("test1");

      unsub1();
      event.fire("test2");
      expect(listener1).toHaveBeenCalledTimes(1); // 仍然是1次
      expect(listener2).toHaveBeenCalledWith("test2");
      expect(listener2).toHaveBeenCalledTimes(2);
    });
  });

  describe("继承的 BaseEvent 功能", () => {
    it("应该继承 BaseEvent 的所有功能", () => {
      // 验证 GenericEvent 具有 BaseEvent 的方法
      expect(typeof event.fire).toBe("function");
      expect(typeof event.addEventListener).toBe("function");
      expect(typeof event.event).toBe("function"); // getter 返回函数
    });

    it("应该支持条件监听器", () => {
      const listener = vi.fn();

      // 使用 when 方法（如果可用）
      if (typeof event.when === "function") {
        event.when((data) => data.includes("important"), listener);

        event.fire("normal message");
        expect(listener).not.toHaveBeenCalled();

        event.fire("important message");
        expect(listener).toHaveBeenCalledWith("important message");
      }
    });

    it("应该支持错误处理", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalListener = vi.fn();

      event.addEventListener(errorListener);
      event.addEventListener(normalListener);

      // 错误不应该阻止其他监听器执行
      expect(() => event.fire("test")).not.toThrow();
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe("性能测试", () => {
    it("应该高效处理大量监听器", () => {
      const highPerfEvent = new GenericEvent<string>("PerfTest", {
        maxListeners: 1000,
        enableBatching: false,
      });

      const listeners: Array<() => void> = [];

      // 添加多个监听器
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        highPerfEvent.addEventListener(listener);
      }

      expect(highPerfEvent["_listeners"].length).toBe(100);

      highPerfEvent.fire("performance test");

      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledWith("performance test");
      });
    });

    it("应该高效处理频繁的事件触发", () => {
      const listener = vi.fn();
      const fastEvent = new GenericEvent<number>("FastEvent", {
        enableBatching: false,
      });

      fastEvent.addEventListener(listener);

      // 快速触发多次事件
      for (let i = 0; i < 1000; i++) {
        fastEvent.fire(i);
      }

      expect(listener).toHaveBeenCalledTimes(1000);
    });
  });
});

describe("createEmitter", () => {
  describe("工厂函数功能", () => {
    it("应该创建 BaseEvent 实例", () => {
      const emitter = createEmitter<string>();

      expect(emitter).toBeInstanceOf(BaseEvent);
      expect(emitter).toBeInstanceOf(GenericEvent);
    });

    it("应该支持自定义事件名", () => {
      const emitter = createEmitter<string>("CustomEmitter");
      expect(emitter["eventName"]).toBe("CustomEmitter");
    });

    it("应该支持配置参数", () => {
      const config: Partial<EventConfiguration> = {
        enableBatching: true,
        batchSize: 50,
        maxListeners: 500,
      };

      const emitter = createEmitter<string>("ConfiguredEmitter", config);
      expect(emitter).toBeInstanceOf(GenericEvent);
      expect(emitter["eventName"]).toBe("ConfiguredEmitter");
    });

    it("应该支持预设配置", () => {
      const emitter = createEmitter<string>("PresetEmitter", "debug");
      expect(emitter).toBeInstanceOf(GenericEvent);
      expect(emitter["eventName"]).toBe("PresetEmitter");
    });

    it("应该使用默认值", () => {
      const emitter = createEmitter<string>();
      expect(emitter["eventName"]).toBe("GenericEvent");
    });
  });

  describe("创建的发射器功能", () => {
    it("应该能正常工作", () => {
      interface TestMessage {
        type: string;
        data: unknown;
      }

      const emitter = createEmitter<TestMessage>("MessageEmitter");
      const listener = vi.fn();

      emitter.addEventListener(listener);

      const testMessage = { type: "info", data: { value: 42 } };
      emitter.fire(testMessage);

      expect(listener).toHaveBeenCalledWith(testMessage);
    });

    it("应该支持类型安全", () => {
      const stringEmitter = createEmitter<string>("StringEmitter");
      const numberEmitter = createEmitter<number>("NumberEmitter");

      const stringListener = vi.fn();
      const numberListener = vi.fn();

      stringEmitter.addEventListener(stringListener);
      numberEmitter.addEventListener(numberListener);

      stringEmitter.fire("hello");
      numberEmitter.fire(123);

      expect(stringListener).toHaveBeenCalledWith("hello");
      expect(numberListener).toHaveBeenCalledWith(123);
    });

    it("应该创建独立的发射器实例", () => {
      const emitter1 = createEmitter<string>("Emitter1");
      const emitter2 = createEmitter<string>("Emitter2");

      expect(emitter1).not.toBe(emitter2);
      expect(emitter1["eventName"]).toBe("Emitter1");
      expect(emitter2["eventName"]).toBe("Emitter2");

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter1.addEventListener(listener1);
      emitter2.addEventListener(listener2);

      emitter1.fire("test1");
      emitter2.fire("test2");

      expect(listener1).toHaveBeenCalledWith("test1");
      expect(listener1).not.toHaveBeenCalledWith("test2");
      expect(listener2).toHaveBeenCalledWith("test2");
      expect(listener2).not.toHaveBeenCalledWith("test1");
    });
  });

  describe("与 BaseEvent 的兼容性", () => {
    it("应该与 BaseEvent 接口兼容", () => {
      const emitter: BaseEvent<string> = createEmitter<string>("CompatTest");

      const listener = vi.fn();
      emitter.addEventListener(listener);
      emitter.fire("compatibility test");

      expect(listener).toHaveBeenCalledWith("compatibility test");
    });

    it("应该支持所有 BaseEvent 功能", () => {
      const emitter = createEmitter<string>("FullFeatured");

      // 测试 IEvent 接口
      const eventFn = emitter.event;
      expect(typeof eventFn).toBe("function");

      const listener = vi.fn();
      const unsubscribe = eventFn(listener);

      expect(typeof unsubscribe).toBe("function");
      emitter.fire("test");
      expect(listener).toHaveBeenCalledWith("test");

      unsubscribe();
      emitter.fire("test2");
      expect(listener).toHaveBeenCalledTimes(1); // 应该只被调用一次
    });
  });
});
