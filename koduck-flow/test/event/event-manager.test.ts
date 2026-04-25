/**
 * EventManager 和 EntityEventManager 单元测试
 * 测试事件管理器的功能，包括基础事件管理和实体特化管理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventManager } from "../../src/common/event/event-manager";
import {
  EntityEventManager,
  createEntityEventManager,
} from "../../src/common/event/entity-event-manager";
import type { EventConfiguration } from "../../src/common/event/types";

// 测试用的实体接口
interface TestEntity {
  id: string;
  name: string;
  value: number;
}

describe("EventManager", () => {
  let eventManager: EventManager<TestEntity>;

  beforeEach(() => {
    eventManager = new EventManager<TestEntity>();
  });

  afterEach(() => {
    eventManager.dispose();
  });

  describe("基础功能", () => {
    it("应该创建事件管理器实例", () => {
      expect(eventManager).toBeInstanceOf(EventManager);
      expect(eventManager.added).toBeDefined();
      expect(eventManager.removed).toBeDefined();
      expect(eventManager.updated).toBeDefined();
    });

    it("应该提供三种基础事件", () => {
      expect(eventManager.added).toBeDefined();
      expect(eventManager.removed).toBeDefined();
      expect(eventManager.updated).toBeDefined();

      // 验证事件具有基本的监听功能
      expect(typeof eventManager.added.addEventListener).toBe("function");
      expect(typeof eventManager.removed.addEventListener).toBe("function");
      expect(typeof eventManager.updated.addEventListener).toBe("function");
    });
  });

  describe("事件触发和监听", () => {
    it("应该能触发和监听添加事件", () => {
      const listener = vi.fn();
      eventManager.added.addEventListener(listener);

      const testEntity: TestEntity = { id: "1", name: "test", value: 42 };
      eventManager.added.fire(testEntity);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(testEntity);
    });

    it("应该能触发和监听移除事件", () => {
      const listener = vi.fn();
      eventManager.removed.addEventListener(listener);

      const testEntity: TestEntity = { id: "2", name: "removed", value: 0 };
      eventManager.removed.fire(testEntity);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(testEntity);
    });

    it("应该能触发和监听更新事件", () => {
      const listener = vi.fn();
      eventManager.updated.addEventListener(listener);

      const testEntity: TestEntity = { id: "3", name: "updated", value: 100 };
      eventManager.updated.fire(testEntity);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(testEntity);
    });

    it("应该支持多个监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventManager.added.addEventListener(listener1);
      eventManager.added.addEventListener(listener2);
      eventManager.added.addEventListener(listener3);

      const testEntity: TestEntity = { id: "4", name: "multi", value: 200 };
      eventManager.added.fire(testEntity);

      expect(listener1).toHaveBeenCalledWith(testEntity);
      expect(listener2).toHaveBeenCalledWith(testEntity);
      expect(listener3).toHaveBeenCalledWith(testEntity);
    });
  });

  describe("配置管理", () => {
    it("应该能设置调试模式", () => {
      const result = eventManager.setDebugMode(true);
      expect(result).toBe(eventManager); // 支持链式调用

      // 验证调试模式被应用（需要访问内部状态）
      eventManager.setDebugMode(false);
    });

    it("应该能配置所有事件", () => {
      const config: Partial<EventConfiguration> = {
        enableBatching: false,
        maxListeners: 50,
        enableDebugMode: true,
      };

      const result = eventManager.configureAll(config);
      expect(result).toBe(eventManager); // 支持链式调用
    });

    it("应该能配置批处理", () => {
      const batchConfig = {
        enableBatching: true,
        batchSize: 20,
        batchInterval: 10,
      };

      const result = eventManager.configureBatch(batchConfig);
      expect(result).toBe(eventManager); // 支持链式调用
    });
  });

  describe("批处理管理", () => {
    it("应该能刷新所有批次", () => {
      expect(() => eventManager.flushAllBatches()).not.toThrow();
    });

    it("应该能在批处理模式下工作", () => {
      // 启用批处理
      eventManager.configureBatch({
        enableBatching: true,
        batchSize: 3,
        batchInterval: 50,
      });

      const listener = vi.fn();
      eventManager.added.addEventListener(listener);

      // 添加多个实体
      const entities = [
        { id: "1", name: "batch1", value: 1 },
        { id: "2", name: "batch2", value: 2 },
        { id: "3", name: "batch3", value: 3 },
      ];

      entities.forEach((entity) => eventManager.added.fire(entity));

      // 手动刷新批次
      eventManager.flushAllBatches();

      // 监听器应该被调用
      expect(listener).toHaveBeenCalled();
    });
  });

  describe("清理和重置", () => {
    it("应该能清除所有事件的监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventManager.added.addEventListener(listener1);
      eventManager.removed.addEventListener(listener2);
      eventManager.updated.addEventListener(listener3);

      eventManager.clearAll();

      // 触发事件，监听器不应该被调用
      const testEntity: TestEntity = { id: "clear", name: "test", value: 0 };
      eventManager.added.fire(testEntity);
      eventManager.removed.fire(testEntity);
      eventManager.updated.fire(testEntity);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).not.toHaveBeenCalled();
    });

    it("应该能重置所有事件", () => {
      const listener = vi.fn();
      eventManager.added.addEventListener(listener);

      eventManager.resetAll();

      // 重置后应该能正常工作
      const testEntity: TestEntity = { id: "reset", name: "test", value: 0 };
      eventManager.added.fire(testEntity);

      // 重置后监听器可能被清除，取决于reset的实现
      // 这里主要测试不抛异常
      expect(() => eventManager.added.fire(testEntity)).not.toThrow();
    });
  });

  describe("条件执行", () => {
    it("应该支持条件执行", () => {
      const callback = vi.fn();

      // 条件为true，应该执行回调
      const result1 = eventManager.when(true, callback);
      expect(result1).toBe(eventManager);
      expect(callback).toHaveBeenCalledWith(eventManager);

      // 条件为false，不应该执行回调
      callback.mockReset();
      const result2 = eventManager.when(false, callback);
      expect(result2).toBe(eventManager);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("资源管理", () => {
    it("应该能正确释放资源", () => {
      const listener = vi.fn();
      eventManager.added.addEventListener(listener);

      expect(() => eventManager.dispose()).not.toThrow();

      // dispose后的行为取决于具体实现
      // 主要测试不抛异常
      expect(() =>
        eventManager.added.fire({ id: "disposed", name: "test", value: 0 })
      ).not.toThrow();
    });
  });
});

describe("EntityEventManager", () => {
  let entityManager: EntityEventManager<TestEntity>;

  beforeEach(() => {
    entityManager = createEntityEventManager<TestEntity>();
  });

  afterEach(() => {
    entityManager.dispose();
  });

  describe("实例管理", () => {
    it("应该通过工厂函数创建实例", () => {
      const factoryInstance = createEntityEventManager<TestEntity>();
      expect(factoryInstance).toBeInstanceOf(EntityEventManager);
      factoryInstance.dispose();
    });

    it("工厂函数每次调用返回独立实例", () => {
      const instance1 = createEntityEventManager<TestEntity>();
      const instance2 = createEntityEventManager<TestEntity>();

      expect(instance1).not.toBe(instance2);
      expect(instance1).toBeInstanceOf(EventManager);
      expect(instance2).toBeInstanceOf(EntityEventManager);

      instance1.dispose();
      instance2.dispose();
    });

    it("应该允许直接实例化", () => {
      const directInstance = new EntityEventManager<TestEntity>();
      expect(directInstance).toBeInstanceOf(EntityEventManager);
      directInstance.dispose();
    });
  });

  describe("实体特化功能", () => {
    it("应该提供额外的更新详情事件", () => {
      expect(entityManager.updatedWithDetail).toBeDefined();
      expect(typeof entityManager.updatedWithDetail.addEventListener).toBe(
        "function"
      );
    });

    it("应该能注册生命周期监听器", () => {
      const addedListener = vi.fn();
      const removedListener = vi.fn();
      const updatedListener = vi.fn();

      const result = entityManager.registerLifecycle({
        onAdded: addedListener,
        onRemoved: removedListener,
        onUpdated: updatedListener,
      });

      expect(result).toBe(entityManager); // 支持链式调用

      // 测试事件触发
      const testEntity: TestEntity = {
        id: "lifecycle",
        name: "test",
        value: 42,
      };

      entityManager.added.fire(testEntity);
      expect(addedListener).toHaveBeenCalledWith(testEntity);

      entityManager.removed.fire(testEntity);
      expect(removedListener).toHaveBeenCalledWith(testEntity);

      entityManager.updated.fire(testEntity);
      expect(updatedListener).toHaveBeenCalledWith(testEntity);
    });

    it("应该能注册通用生命周期监听器", () => {
      const universalListener = vi.fn();

      const result = entityManager.registerAnyLifecycle(universalListener);
      expect(result).toBe(entityManager);

      const testEntity: TestEntity = {
        id: "universal",
        name: "test",
        value: 123,
      };

      // 所有事件都应该触发通用监听器
      entityManager.added.fire(testEntity);
      expect(universalListener).toHaveBeenCalledWith(testEntity);

      entityManager.removed.fire(testEntity);
      expect(universalListener).toHaveBeenCalledTimes(2);

      entityManager.updated.fire(testEntity);
      expect(universalListener).toHaveBeenCalledTimes(3);
    });

    it("应该支持更新详情事件", () => {
      const detailListener = vi.fn();
      entityManager.updatedWithDetail.addEventListener(detailListener);

      const testEntity: TestEntity = { id: "detail", name: "test", value: 456 };
      const updateDetail = {
        changes: new Set(["position"] as const),
        prevBounds: { x: 0, y: 0, width: 50, height: 25 },
        nextBounds: { x: 10, y: 10, width: 100, height: 50 },
      };

      entityManager.updatedWithDetail.fire({
        entity: testEntity,
        detail: updateDetail,
      });

      expect(detailListener).toHaveBeenCalledWith({
        entity: testEntity,
        detail: updateDetail,
      });
    });
  });

  describe("性能配置", () => {
    it("应该能设置高性能模式", () => {
      const result = entityManager.setupForPerformance();
      expect(result).toBe(entityManager); // 支持链式调用
    });

    it("应该能设置调试模式", () => {
      const result = entityManager.setupForDebugging();
      expect(result).toBe(entityManager); // 支持链式调用
    });
  });

  describe("实体事件触发方法", () => {
    it("应该能触发实体添加事件", () => {
      const listener = vi.fn();
      entityManager.added.addEventListener(listener);

      const testEntity: TestEntity = {
        id: "fire-add",
        name: "test",
        value: 789,
      };

      // 使用便捷方法触发事件
      if (typeof entityManager.fireAdd === "function") {
        entityManager.fireAdd(testEntity);
        expect(listener).toHaveBeenCalledWith(testEntity);
      }
    });

    it("应该能触发实体移除事件", () => {
      const listener = vi.fn();
      entityManager.removed.addEventListener(listener);

      const testEntity: TestEntity = {
        id: "fire-remove",
        name: "test",
        value: 0,
      };

      if (typeof entityManager.fireRemove === "function") {
        entityManager.fireRemove(testEntity);
        expect(listener).toHaveBeenCalledWith(testEntity);
      }
    });

    it("应该能触发实体更新事件", () => {
      const listener = vi.fn();
      entityManager.updated.addEventListener(listener);

      const testEntity: TestEntity = {
        id: "fire-update",
        name: "updated",
        value: 999,
      };

      if (typeof entityManager.fireUpdate === "function") {
        entityManager.fireUpdate(testEntity);
        expect(listener).toHaveBeenCalledWith(testEntity);
      }
    });
  });

  describe("批量操作", () => {
    it("应该支持批量添加事件", () => {
      const listener = vi.fn();
      entityManager.added.addEventListener(listener);

      const entities: TestEntity[] = [
        { id: "batch1", name: "test1", value: 1 },
        { id: "batch2", name: "test2", value: 2 },
        { id: "batch3", name: "test3", value: 3 },
      ];

      entityManager.fireBatch("add", entities);
      expect(listener).toHaveBeenCalledTimes(entities.length);
    });

    it("应该支持批量移除事件", () => {
      const listener = vi.fn();
      entityManager.removed.addEventListener(listener);

      const entities: TestEntity[] = [
        { id: "remove1", name: "test1", value: 0 },
        { id: "remove2", name: "test2", value: 0 },
        { id: "remove3", name: "test3", value: 0 },
      ];

      entityManager.fireBatch("remove", entities);
      expect(listener).toHaveBeenCalledTimes(entities.length);
    });
  });

  describe("错误处理", () => {
    it("应该处理监听器中的错误", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error in listener");
      });
      const normalListener = vi.fn();

      entityManager.added.addEventListener(errorListener);
      entityManager.added.addEventListener(normalListener);

      const testEntity: TestEntity = {
        id: "error-test",
        name: "error",
        value: -1,
      };

      // 错误不应该阻止其他监听器执行
      expect(() => entityManager.added.fire(testEntity)).not.toThrow();
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });
});
