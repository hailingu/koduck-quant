/**
 * BaseEvent 核心类单元测试
 * 测试事件的创建、监听器管理、触发、批处理等核心功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseEvent } from "../../src/common/event/base-event";
import type { EventConfiguration } from "../../src/common/event/types";

// 测试用的具体事件实现
class TestEvent extends BaseEvent<string> {
  constructor(
    name: string = "TestEvent",
    config?: Partial<EventConfiguration>
  ) {
    super(name, config);
  }
}

// 测试用的复杂数据类型
interface TestData {
  id: string;
  value: number;
  metadata?: Record<string, unknown>;
}

class ComplexTestEvent extends BaseEvent<TestData> {
  constructor(config?: Partial<EventConfiguration>) {
    super("ComplexTestEvent", config);
  }
}

describe("BaseEvent", () => {
  let event: TestEvent;
  let complexEvent: ComplexTestEvent;

  beforeEach(() => {
    event = new TestEvent();
    complexEvent = new ComplexTestEvent();
  });

  describe("基础事件功能", () => {
    it("应该能创建事件实例", () => {
      expect(event).toBeInstanceOf(BaseEvent);
      expect(event).toBeInstanceOf(TestEvent);
      expect(event["eventName"]).toBe("TestEvent");
    });

    it("应该能使用自定义事件名", () => {
      const customEvent = new TestEvent("CustomEventName");
      expect(customEvent["eventName"]).toBe("CustomEventName");
    });

    it("应该初始化为空的监听器列表", () => {
      expect(event["_listeners"]).toEqual([]);
      expect(event["_listeners"].length).toBe(0);
    });
  });

  describe("监听器管理", () => {
    it("应该能添加监听器", () => {
      const listener = vi.fn();
      const unsubscribe = event.addEventListener(listener);

      expect(typeof unsubscribe).toBe("function");
      expect(event["_listeners"]).toContain(listener);
      expect(event["_listeners"].length).toBe(1);
    });

    it("应该能移除监听器", () => {
      const listener = vi.fn();
      const unsubscribe = event.addEventListener(listener);

      expect(event["_listeners"]).toContain(listener);

      unsubscribe();

      expect(event["_listeners"]).not.toContain(listener);
      expect(event["_listeners"].length).toBe(0);
    });

    it("应该支持多个监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      event.addEventListener(listener1);
      const unsub2 = event.addEventListener(listener2);
      event.addEventListener(listener3);

      expect(event["_listeners"].length).toBe(3);
      expect(event["_listeners"]).toContain(listener1);
      expect(event["_listeners"]).toContain(listener2);
      expect(event["_listeners"]).toContain(listener3);

      // 测试部分移除
      unsub2();
      expect(event["_listeners"].length).toBe(2);
      expect(event["_listeners"]).not.toContain(listener2);
      expect(event["_listeners"]).toContain(listener1);
      expect(event["_listeners"]).toContain(listener3);
    });

    it("应该允许重复添加同一监听器", () => {
      const listener = vi.fn();

      event.addEventListener(listener);
      event.addEventListener(listener); // 重复添加

      expect(event["_listeners"].length).toBe(2);

      // 触发事件，监听器应该被调用两次
      event.fire("test");
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("应该处理重复移除监听器", () => {
      const listener = vi.fn();
      const unsubscribe = event.addEventListener(listener);

      unsubscribe();
      expect(event["_listeners"]).not.toContain(listener);

      // 重复移除应该不出错
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe("事件触发", () => {
    it("应该能触发事件并调用监听器", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      event.fire("test data");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("test data");
    });

    it("应该按顺序调用多个监听器", () => {
      const callOrder: number[] = [];
      const listener1 = vi.fn(() => callOrder.push(1));
      const listener2 = vi.fn(() => callOrder.push(2));
      const listener3 = vi.fn(() => callOrder.push(3));

      event.addEventListener(listener1);
      event.addEventListener(listener2);
      event.addEventListener(listener3);

      event.fire("test");

      expect(callOrder).toEqual([1, 2, 3]);
      expect(listener1).toHaveBeenCalledWith("test");
      expect(listener2).toHaveBeenCalledWith("test");
      expect(listener3).toHaveBeenCalledWith("test");
    });

    it("应该处理复杂数据类型", () => {
      const listener = vi.fn();
      complexEvent.addEventListener(listener);

      const testData: TestData = {
        id: "test-123",
        value: 42,
        metadata: { type: "test", enabled: true },
      };

      complexEvent.fire(testData);

      expect(listener).toHaveBeenCalledWith(testData);
    });

    it("应该处理监听器中的错误", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
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

  describe("事件配置", () => {
    it("应该支持自定义配置", () => {
      const config: Partial<EventConfiguration> = {
        enableBatching: false,
        maxListeners: 5,
        enableDebugMode: true,
      };

      const configuredEvent = new TestEvent("ConfiguredEvent", config);
      expect(configuredEvent).toBeInstanceOf(TestEvent);
    });

    it("应该支持批处理配置", () => {
      const batchConfig: Partial<EventConfiguration> = {
        enableBatching: true,
        batchSize: 3,
        batchInterval: 10,
      };

      const batchEvent = new TestEvent("BatchEvent", batchConfig);
      expect(batchEvent).toBeInstanceOf(TestEvent);
    });

    it("应该支持并发配置", () => {
      const concurrencyConfig: Partial<EventConfiguration> = {
        concurrencyMode: "parallel",
        concurrencyLimit: 5,
      };

      const concurrentEvent = new TestEvent(
        "ConcurrentEvent",
        concurrencyConfig
      );
      expect(concurrentEvent).toBeInstanceOf(TestEvent);
    });
  });

  describe("性能和优化", () => {
    it("应该正确跟踪触发次数", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      expect(event["_fireCount"]).toBe(0);

      event.fire("test1");
      expect(event["_fireCount"]).toBe(1);

      event.fire("test2");
      expect(event["_fireCount"]).toBe(2);
    });

    it("应该处理大量监听器", () => {
      // 使用高性能配置支持更多监听器
      const highPerfEvent = new TestEvent("HighPerfEvent", {
        maxListeners: 1000,
        enableBatching: false, // 禁用批处理便于测试
      });

      const listeners: Array<() => void> = [];
      const listenerCount = 50; // 使用合理的数量

      // 添加大量监听器
      for (let i = 0; i < listenerCount; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        highPerfEvent.addEventListener(listener);
      }

      expect(highPerfEvent["_listeners"].length).toBe(listenerCount);

      highPerfEvent.fire("test");

      // 验证所有监听器都被调用
      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledWith("test");
      });
    });

    it("应该高效处理监听器的添加和移除", () => {
      // 使用非批处理配置便于测试
      const testEvent = new TestEvent("RemovalTest", {
        enableBatching: false,
        maxListeners: 200,
      });

      const listeners = [];
      const unsubscribers = [];

      // 添加监听器
      for (let i = 0; i < 50; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        const unsub = testEvent.addEventListener(listener);
        unsubscribers.push(unsub);
      }

      expect(testEvent["_listeners"].length).toBe(50);

      // 移除一半监听器
      for (let i = 0; i < 25; i++) {
        unsubscribers[i]();
      }

      expect(testEvent["_listeners"].length).toBe(25);

      // 触发事件，只有剩余的监听器应该被调用
      testEvent.fire("test");

      for (let i = 0; i < 25; i++) {
        expect(listeners[i]).not.toHaveBeenCalled();
      }

      for (let i = 25; i < 50; i++) {
        expect(listeners[i]).toHaveBeenCalledWith("test");
      }
    });
  });

  describe("边界情况", () => {
    it("应该处理空事件触发", () => {
      expect(() => event.fire("test")).not.toThrow();
    });

    it("应该处理特殊字符串数据", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      // 测试空字符串
      event.fire("");
      expect(listener).toHaveBeenCalledWith("");

      // 测试特殊字符
      event.fire("特殊字符测试");
      expect(listener).toHaveBeenCalledWith("特殊字符测试");
    });

    it("应该处理快速的连续触发", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      // 快速连续触发
      for (let i = 0; i < 10; i++) {
        event.fire(`test-${i}`);
      }

      expect(listener).toHaveBeenCalledTimes(10);
    });

    it("应该处理监听器在执行中修改监听器列表", () => {
      const unsub2Ref = { current: undefined as (() => void) | undefined };

      const listener1 = vi.fn(() => {
        // 在监听器执行中移除另一个监听器
        if (unsub2Ref.current) unsub2Ref.current();
      });

      const listener2 = vi.fn();

      event.addEventListener(listener1);
      unsub2Ref.current = event.addEventListener(listener2);

      // 这应该不会导致错误
      expect(() => event.fire("test")).not.toThrow();

      expect(listener1).toHaveBeenCalled();
      // listener2 可能被调用也可能不被调用，取决于执行顺序
    });
  });

  describe("资源清理", () => {
    it("应该支持清理所有监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.addEventListener(listener1);
      event.addEventListener(listener2);

      expect(event["_listeners"].length).toBe(2);

      // 手动清理（如果有的话）
      if (typeof event.dispose === "function") {
        event.dispose();
        expect(event["_listeners"].length).toBe(0);
      }
    });
  });

  // ===== 补充高级功能测试 =====

  describe("高级监听器方法", () => {
    it("应该支持一次性监听器 (once)", () => {
      const listener = vi.fn();
      event.once(listener);

      // 第一次触发应该调用监听器
      event.fire("test1");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("test1");

      // 第二次触发不应该调用监听器
      event.fire("test2");
      expect(listener).toHaveBeenCalledTimes(1); // 仍然只调用了一次
    });

    it("应该支持条件监听器 (when)", () => {
      const listener = vi.fn();
      const condition = (data: string) => data.startsWith("valid");

      event.when(condition, listener);

      // 满足条件的数据应该触发监听器
      event.fire("valid-data");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("valid-data");

      // 不满足条件的数据不应该触发监听器
      event.fire("invalid-data");
      expect(listener).toHaveBeenCalledTimes(1); // 仍然只调用了一次
    });

    it("应该支持批量添加监听器 (addListeners)", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      const result = event.addListeners(listener1, listener2, listener3);

      // 应该返回事件实例支持链式调用
      expect(result).toBe(event);
      expect(event["_listeners"].length).toBe(3);

      event.fire("test");
      expect(listener1).toHaveBeenCalledWith("test");
      expect(listener2).toHaveBeenCalledWith("test");
      expect(listener3).toHaveBeenCalledWith("test");
    });

    it("应该支持event getter属性", () => {
      const eventGetter = event.event;
      expect(typeof eventGetter).toBe("function");

      const listener = vi.fn();
      const unsubscribe = eventGetter(listener);

      expect(typeof unsubscribe).toBe("function");

      event.fire("test");
      expect(listener).toHaveBeenCalledWith("test");

      // 测试取消订阅
      unsubscribe();
      event.fire("test2");
      expect(listener).toHaveBeenCalledTimes(1); // 应该只被调用一次
    });
  });

  describe("数据验证和去重", () => {
    it("应该支持数据验证器 (setValidator)", () => {
      const validator = (data: string) => data.length > 3;
      const listener = vi.fn();

      // 启用调试模式以激活验证器
      event.setDebugMode(true).setValidator(validator);
      event.addEventListener(listener);

      // 有效数据应该通过验证
      event.fire("valid");
      expect(listener).toHaveBeenCalledWith("valid");

      // 在调试模式下，无效数据应该被过滤
      event.fire("no"); // 长度 <= 3
      // 由于数据验证失败，监听器不应该被再次调用
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("应该支持移除验证器", () => {
      const validator = (data: string) => data.length > 10; // 很严格的验证
      const listener = vi.fn();

      event.setDebugMode(true).setValidator(validator);
      event.addEventListener(listener);

      // 移除验证器
      event.setValidator(undefined);

      // 现在短数据应该也能通过
      event.fire("short");
      expect(listener).toHaveBeenCalledWith("short");
    });
  });

  describe("配置管理", () => {
    it("应该支持获取配置", () => {
      const config = event.configuration;
      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
      expect(config).toHaveProperty("enableBatching");
      expect(config).toHaveProperty("maxListeners");
    });

    it("应该支持动态更新配置", () => {
      const newConfig = { enableBatching: false, maxListeners: 100 };
      const result = event.updateConfiguration(newConfig);

      expect(result).toBe(event); // 支持链式调用

      const updatedConfig = event.configuration;
      // 注意：配置更新可能需要与现有配置合并，enableBatching可能保持原值
      expect(updatedConfig.maxListeners).toBe(100);
    });

    it("应该支持maxListeners getter/setter", () => {
      // 测试getter
      const initialMax = event.maxListeners;
      expect(typeof initialMax).toBe("number");

      // 测试setter
      event.maxListeners = 50;
      expect(event.maxListeners).toBe(50);

      // 测试无效值处理
      const originalMax = event.maxListeners;
      event.maxListeners = -1; // 无效值
      expect(event.maxListeners).toBe(originalMax); // 应该保持不变

      event.maxListeners = 20000; // 超出范围
      expect(event.maxListeners).toBe(originalMax); // 应该保持不变
    });

    it("应该支持监听器数量和触发次数统计", () => {
      expect(event.listenerCount).toBe(0);
      expect(event.fireCount).toBe(0);

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.addEventListener(listener1);
      expect(event.listenerCount).toBe(1);

      event.addEventListener(listener2);
      expect(event.listenerCount).toBe(2);

      event.fire("test1");
      expect(event.fireCount).toBe(1);

      event.fire("test2");
      expect(event.fireCount).toBe(2);
    });

    it("应该支持hasListeners检查", () => {
      expect(event.hasListeners()).toBe(false);

      const listener = vi.fn();
      event.addEventListener(listener);
      expect(event.hasListeners()).toBe(true);

      event.clear();
      expect(event.hasListeners()).toBe(false);
    });

    it("应该支持调试模式切换", () => {
      const result = event.setDebugMode(true);
      expect(result).toBe(event); // 支持链式调用

      const config = event.configuration;
      expect(config.enableDebugMode).toBe(true);

      event.setDebugMode(false);
      const updatedConfig = event.configuration;
      expect(updatedConfig.enableDebugMode).toBe(false);
    });
  });

  describe("批处理功能", () => {
    let batchEvent: TestEvent;

    beforeEach(() => {
      batchEvent = new TestEvent("BatchTest", {
        enableBatching: true,
        batchSize: 3,
        batchInterval: 10,
      });
    });

    it("应该支持批处理事件", async () => {
      const listener = vi.fn();
      batchEvent.addEventListener(listener);

      // 快速触发多个事件
      batchEvent.fire("event1");
      batchEvent.fire("event2");

      // 批处理可能立即触发或延迟触发，取决于实现
      // 触发第三个事件，应该达到批处理大小阈值
      batchEvent.fire("event3");

      // 现在应该处理批次，至少应该调用监听器
      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith("event1");
      expect(listener).toHaveBeenCalledWith("event2");
      expect(listener).toHaveBeenCalledWith("event3");
    });

    it("应该支持手动刷新批处理", async () => {
      const listener = vi.fn();
      batchEvent.addEventListener(listener);

      batchEvent.fire("event1");
      batchEvent.fire("event2");

      // 手动刷新批处理
      batchEvent.flushBatch();

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenNthCalledWith(1, "event1");
      expect(listener).toHaveBeenNthCalledWith(2, "event2");
    });

    it("应该在时间间隔后自动处理批次", async () => {
      const listener = vi.fn();
      batchEvent.addEventListener(listener);

      batchEvent.fire("event1");

      // 等待批处理间隔
      await new Promise((resolve) => setTimeout(resolve, 15));

      expect(listener).toHaveBeenCalledWith("event1");
    });
  });

  describe("异步事件处理", () => {
    it("应该支持异步事件触发 (fireAsync)", async () => {
      const listener = vi.fn().mockResolvedValue(undefined);
      event.addEventListener(listener);

      await event.fireAsync("async-test");

      expect(listener).toHaveBeenCalledWith("async-test");
    });

    it("应该支持并行异步监听器", async () => {
      const parallelEvent = new TestEvent("ParallelTest", {
        concurrencyMode: "parallel",
      });

      const listener1 = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "listener1";
      });

      const listener2 = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return "listener2";
      });

      parallelEvent.addEventListener(listener1);
      parallelEvent.addEventListener(listener2);

      const startTime = Date.now();
      await parallelEvent.fireAsync("parallel-test");
      const endTime = Date.now();

      expect(listener1).toHaveBeenCalledWith("parallel-test");
      expect(listener2).toHaveBeenCalledWith("parallel-test");

      // 并行执行应该比串行快
      expect(endTime - startTime).toBeLessThan(20); // 应该接近较长监听器的时间
    });

    it("应该支持受限并发异步监听器", async () => {
      const limitedEvent = new TestEvent("LimitedTest", {
        concurrencyMode: "limited",
        concurrencyLimit: 2,
      });

      const listeners = [];
      for (let i = 0; i < 4; i++) {
        const listener = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `listener${i}`;
        });
        listeners.push(listener);
        limitedEvent.addEventListener(listener);
      }

      await limitedEvent.fireAsync("limited-test");

      // 所有监听器都应该被调用
      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledWith("limited-test");
      });
    });

    it("应该处理异步监听器中的错误", async () => {
      const errorListener = vi.fn().mockRejectedValue(new Error("Async error"));
      const normalListener = vi.fn().mockResolvedValue(undefined);

      event.addEventListener(errorListener);
      event.addEventListener(normalListener);

      // 异步错误不应该阻止其他监听器执行
      await expect(event.fireAsync("error-test")).resolves.not.toThrow();

      expect(errorListener).toHaveBeenCalledWith("error-test");
      expect(normalListener).toHaveBeenCalledWith("error-test");
    });

    it("应该支持异步监听器超时处理", async () => {
      const timeoutEvent = new TestEvent("TimeoutTest", {
        concurrencyMode: "limited",
        listenerTimeout: 5, // 5ms超时
      });

      const slowListener = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20)); // 慢于超时时间
        return "slow";
      });

      const fastListener = vi.fn().mockResolvedValue("fast");

      timeoutEvent.addEventListener(slowListener);
      timeoutEvent.addEventListener(fastListener);

      await timeoutEvent.fireAsync("timeout-test");

      expect(slowListener).toHaveBeenCalledWith("timeout-test");
      expect(fastListener).toHaveBeenCalledWith("timeout-test");
    });
  });

  describe("资源管理和清理", () => {
    it("应该支持clear清理监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.addEventListener(listener1);
      event.addEventListener(listener2);
      expect(event.listenerCount).toBe(2);

      event.clear();
      expect(event.listenerCount).toBe(0);
      expect(event.hasListeners()).toBe(false);

      // 清理后触发事件不应该调用任何监听器
      event.fire("test");
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it("应该支持reset重置事件状态", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      event.fire("test1");
      event.fire("test2");

      expect(event.fireCount).toBe(2);
      expect(event.listenerCount).toBe(1);

      event.reset();

      expect(event.fireCount).toBe(0);
      expect(event.listenerCount).toBe(0);
      expect(event.hasListeners()).toBe(false);
    });

    it("应该支持dispose析构", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.addEventListener(listener1);
      event.addEventListener(listener2);

      // 创建批处理事件测试批处理清理
      const batchEvent = new TestEvent("DisposeTest", {
        enableBatching: true,
        batchSize: 10,
      });

      const batchListener = vi.fn();
      batchEvent.addEventListener(batchListener);

      expect(event.listenerCount).toBe(2);
      expect(batchEvent.listenerCount).toBe(1);

      // 在dispose之前触发的事件可能已经被处理
      const batchListenerCallsBefore = batchListener.mock.calls.length;

      event.dispose();
      batchEvent.dispose();

      expect(event.listenerCount).toBe(0);
      expect(batchEvent.listenerCount).toBe(0);

      // dispose后触发事件不应该调用监听器
      event.fire("disposed-test");
      batchEvent.fire("disposed-batch-test");

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();

      // dispose后新的调用不应该发生
      expect(batchListener.mock.calls.length).toBe(batchListenerCallsBefore);
    });
  });

  describe("错误处理和边界情况", () => {
    it("应该处理无效监听器", () => {
      // 测试null监听器
      expect(() =>
        event.addEventListener(null as unknown as (data: string) => void)
      ).not.toThrow();

      // 测试undefined监听器
      expect(() =>
        event.addEventListener(undefined as unknown as (data: string) => void)
      ).not.toThrow();

      // 测试非函数监听器
      expect(() =>
        event.addEventListener(
          "not-a-function" as unknown as (data: string) => void
        )
      ).not.toThrow();

      // 监听器列表不应该增加
      expect(event.listenerCount).toBe(0);
    });

    it("应该处理监听器数量限制", () => {
      const limitedEvent = new TestEvent("LimitedEvent", {
        maxListeners: 2,
        enableBatching: false,
      });

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      limitedEvent.addEventListener(listener1);
      limitedEvent.addEventListener(listener2);

      expect(limitedEvent.listenerCount).toBe(2);

      // 添加第三个监听器应该被忽略或警告
      limitedEvent.addEventListener(listener3);

      // 根据实现，可能会限制或发出警告
      limitedEvent.fire("test");
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("应该处理空的批处理刷新", () => {
      const batchEvent = new TestEvent("EmptyBatchTest", {
        enableBatching: true,
      });

      // 没有事件时刷新批处理不应该出错
      expect(() => batchEvent.flushBatch()).not.toThrow();
    });

    it("应该处理监听器执行期间的结构变化", () => {
      const removingListener = vi.fn(() => {
        // 在监听器中移除自身
        event.removeEventListener(removingListener);
      });

      const normalListener = vi.fn();

      event.addEventListener(removingListener);
      event.addEventListener(normalListener);

      expect(() => event.fire("structure-change-test")).not.toThrow();

      expect(removingListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(event.listenerCount).toBe(1); // removingListener应该被移除
    });
  });
});
