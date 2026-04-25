import { describe, test, expect } from "vitest";
import * as EventModule from "../../src/common/event/index";

describe("Event Module Index", () => {
  describe("Core Event Infrastructure", () => {
    test("应该导出BaseEvent", () => {
      expect(EventModule.BaseEvent).toBeDefined();
      expect(typeof EventModule.BaseEvent).toBe("function");
    });

    test("应该导出GenericEvent", () => {
      expect(EventModule.GenericEvent).toBeDefined();
      expect(typeof EventModule.GenericEvent).toBe("function");
    });

    test("应该导出createEmitter", () => {
      expect(EventModule.createEmitter).toBeDefined();
      expect(typeof EventModule.createEmitter).toBe("function");
    });

    test("应该BaseEvent可以实例化", () => {
      // 由于BaseEvent是抽象类，我们通过GenericEvent测试
      const event = new EventModule.GenericEvent("test");
      expect(event).toBeInstanceOf(EventModule.BaseEvent);
    });

    test("应该createEmitter返回GenericEvent实例", () => {
      const emitter = EventModule.createEmitter<string>("test");
      expect(emitter).toBeInstanceOf(EventModule.GenericEvent);
      expect(emitter).toBeInstanceOf(EventModule.BaseEvent);
    });
  });

  describe("Entity Events", () => {
    test("应该导出EntityEvent", () => {
      expect(EventModule.EntityEvent).toBeDefined();
      expect(typeof EventModule.EntityEvent).toBe("function");
    });

    test("应该导出EntityAddEvent", () => {
      expect(EventModule.EntityAddEvent).toBeDefined();
      expect(typeof EventModule.EntityAddEvent).toBe("function");
    });

    test("应该导出EntityRemoveEvent", () => {
      expect(EventModule.EntityRemoveEvent).toBeDefined();
      expect(typeof EventModule.EntityRemoveEvent).toBe("function");
    });

    test("应该导出EntityUpdateEvent", () => {
      expect(EventModule.EntityUpdateEvent).toBeDefined();
      expect(typeof EventModule.EntityUpdateEvent).toBe("function");
    });

    test("应该导出EntityEventType", () => {
      expect(EventModule.EntityEventType).toBeDefined();
      expect(typeof EventModule.EntityEventType).toBe("object");
    });

    test("EntityEventType应该包含正确的值", () => {
      expect(EventModule.EntityEventType.ADD).toBe("EntityAdd");
      expect(EventModule.EntityEventType.REMOVE).toBe("EntityRemove");
      expect(EventModule.EntityEventType.UPDATE).toBe("EntityUpdate");
    });

    test("应该能够实例化EntityEvent", () => {
      const entityEvent = new EventModule.EntityEvent(EventModule.EntityEventType.ADD);
      expect(entityEvent).toBeInstanceOf(EventModule.EntityEvent);
    });

    test("应该能够实例化EntityAddEvent", () => {
      const addEvent = new EventModule.EntityAddEvent();
      expect(addEvent).toBeInstanceOf(EventModule.EntityAddEvent);
      expect(addEvent).toBeInstanceOf(EventModule.EntityEvent);
    });

    test("应该能够实例化EntityRemoveEvent", () => {
      const removeEvent = new EventModule.EntityRemoveEvent();
      expect(removeEvent).toBeInstanceOf(EventModule.EntityRemoveEvent);
      expect(removeEvent).toBeInstanceOf(EventModule.EntityEvent);
    });

    test("应该能够实例化EntityUpdateEvent", () => {
      const updateEvent = new EventModule.EntityUpdateEvent();
      expect(updateEvent).toBeInstanceOf(EventModule.EntityUpdateEvent);
      expect(updateEvent).toBeInstanceOf(EventModule.EntityEvent);
    });
  });

  describe("Event Managers", () => {
    test("应该导出EventManager", () => {
      expect(EventModule.EventManager).toBeDefined();
      expect(typeof EventModule.EventManager).toBe("function");
    });

    test("应该导出EntityEventManager", () => {
      expect(EventModule.EntityEventManager).toBeDefined();
      expect(typeof EventModule.EntityEventManager).toBe("function");
    });

    test("应该导出createEntityEventManager", () => {
      expect(EventModule.createEntityEventManager).toBeDefined();
      expect(typeof EventModule.createEntityEventManager).toBe("function");
    });

    test("应该能够实例化EventManager", () => {
      const manager = new EventModule.EventManager();
      expect(manager).toBeInstanceOf(EventModule.EventManager);
    });

    test("createEntityEventManager应该返回独立实例", () => {
      const instance1 = EventModule.createEntityEventManager();
      const instance2 = EventModule.createEntityEventManager();

      expect(instance1).not.toBe(instance2);
      expect(instance1).toBeInstanceOf(EventModule.EntityEventManager);
      expect(instance2).toBeInstanceOf(EventModule.EntityEventManager);

      instance1.dispose();
      instance2.dispose();
    });
  });

  describe("System Event Bus", () => {
    test("应该导出EventBus", () => {
      expect(EventModule.EventBus).toBeDefined();
      expect(typeof EventModule.EventBus).toBe("function");
    });

    test("应该导出createEventBus", () => {
      expect(EventModule.createEventBus).toBeDefined();
      expect(typeof EventModule.createEventBus).toBe("function");
    });

    test("应该导出LoggingEvent", () => {
      expect(EventModule.LoggingEvent).toBeDefined();
      expect(typeof EventModule.LoggingEvent).toBe("function");
    });

    test("应该导出SystemEventBus", () => {
      expect(EventModule.SystemEventBus).toBeDefined();
      expect(typeof EventModule.SystemEventBus).toBe("function");
    });

    test("createEventBus应该返回新的EventBus实例", () => {
      const bus1 = EventModule.createEventBus();
      const bus2 = EventModule.createEventBus();

      expect(bus1).toBeInstanceOf(EventModule.EventBus);
      expect(bus2).toBeInstanceOf(EventModule.EventBus);
      expect(bus1).not.toBe(bus2);

      bus1.dispose();
      bus2.dispose();
    });

    test("应该能够实例化LoggingEvent", () => {
      const loggingEvent = new EventModule.LoggingEvent();
      expect(loggingEvent).toBeInstanceOf(EventModule.LoggingEvent);
      expect(loggingEvent).toBeInstanceOf(EventModule.BaseEvent);
    });

    test("应该能够实例化SystemEventBus", () => {
      const systemEventBus = new EventModule.SystemEventBus();
      expect(systemEventBus).toBeInstanceOf(EventModule.SystemEventBus);
      expect(systemEventBus).toBeInstanceOf(EventModule.BaseEvent);
    });
  });

  describe("Render Event Manager", () => {
    test("应该导出RenderEventManager", () => {
      expect(EventModule.RenderEventManager).toBeDefined();
      expect(typeof EventModule.RenderEventManager).toBe("function");
    });

    test("应该导出createRenderEventManager", () => {
      expect(EventModule.createRenderEventManager).toBeDefined();
      expect(typeof EventModule.createRenderEventManager).toBe("function");
    });

    test("createRenderEventManager应该返回独立实例", () => {
      const renderManager1 = EventModule.createRenderEventManager();
      const renderManager2 = EventModule.createRenderEventManager();

      expect(renderManager1).toBeInstanceOf(EventModule.RenderEventManager);
      expect(renderManager2).toBeInstanceOf(EventModule.RenderEventManager);
      expect(renderManager1).not.toBe(renderManager2);
    });
  });

  describe("Module Structure", () => {
    test("应该导出所有预期的成员", () => {
      const expectedExports = [
        // Core
        "BaseEvent",
        "GenericEvent",
        "createEmitter",

        // Entity Events
        "EntityEvent",
        "EntityAddEvent",
        "EntityRemoveEvent",
        "EntityUpdateEvent",
        "EntityEventType",

        // Managers
        "EventManager",
        "EntityEventManager",
        "createEntityEventManager",

        // System Event Bus
        "EventBus",
        "LoggingEvent",
        "SystemEventBus",
        "createEventBus",

        // Render Event Manager
        "RenderEventManager",
        "createRenderEventManager",

        // Utilities
        "BatchManager",
        "DedupeManager",
        "SchedulerManager",
        "ErrorReporter",
        "MetricsCollector",
      ];

      expectedExports.forEach((exportName) => {
        expect(EventModule).toHaveProperty(exportName);
        expect(EventModule[exportName as keyof typeof EventModule]).toBeDefined();
      });
    });

    test("应该不导出意外的成员", () => {
      const actualExports = Object.keys(EventModule);
      const expectedExports = [
        "BaseEvent",
        "GenericEvent",
        "createEmitter",
        "EntityEvent",
        "EntityAddEvent",
        "EntityRemoveEvent",
        "EntityUpdateEvent",
        "EntityEventType",
        "EventManager",
        "EntityEventManager",
        "createEntityEventManager",
        "EventBus",
        "LoggingEvent",
        "SystemEventBus",
        "createEventBus",
        "RenderEventManager",
        "createRenderEventManager",
        "BatchManager",
        "DedupeManager",
        "SchedulerManager",
        "ErrorReporter",
        "MetricsCollector",
        "ListenerSnapshotPool",
        "defaultListenerSnapshotPool",
      ];

      // 检查是否有意外的导出
      const unexpectedExports = actualExports.filter(
        (exportName) => !expectedExports.includes(exportName)
      );

      expect(unexpectedExports).toEqual([]);
    });

    test("应该所有导出都是可用的", () => {
      Object.keys(EventModule).forEach((exportName) => {
        const exportValue = EventModule[exportName as keyof typeof EventModule];
        expect(exportValue).toBeDefined();
        expect(exportValue).not.toBeNull();
      });
    });
  });

  describe("Integration Tests", () => {
    test("应该支持完整的事件系统工作流", () => {
      // 创建基础事件
      const genericEvent = new EventModule.GenericEvent<string>("integration-test");

      // 创建实体事件
      const entityAdd = new EventModule.EntityAddEvent();

      // 获取管理器实例
      const eventBus = EventModule.createEventBus();
      const entityManager = EventModule.createEntityEventManager();
      const renderManager = EventModule.createRenderEventManager();

      // 验证所有组件都正常工作
      expect(genericEvent).toBeInstanceOf(EventModule.BaseEvent);
      expect(entityAdd).toBeInstanceOf(EventModule.EntityEvent);
      expect(eventBus).toBeInstanceOf(EventModule.EventBus);
      expect(entityManager).toBeInstanceOf(EventModule.EntityEventManager);
      expect(renderManager).toBeInstanceOf(EventModule.RenderEventManager);

      // 清理
      eventBus.dispose();
      entityManager.dispose();
      genericEvent.dispose();
    });

    test("应该支持事件类型检查", () => {
      // 测试类型系统是否正常工作
      const emitter = EventModule.createEmitter<number>("number-test");
      const listener = (value: number) => {
        expect(typeof value).toBe("number");
      };

      emitter.addEventListener(listener);
      emitter.fire(42);

      emitter.dispose();
    });

    test("应该支持实体事件类型枚举", () => {
      const { EntityEventType } = EventModule;

      // 验证枚举值
      expect(EntityEventType.ADD).toBe("EntityAdd");
      expect(EntityEventType.REMOVE).toBe("EntityRemove");
      expect(EntityEventType.UPDATE).toBe("EntityUpdate");

      // 验证枚举可以用于事件创建
      const addEvent = new EventModule.EntityEvent(EntityEventType.ADD);
      const removeEvent = new EventModule.EntityEvent(EntityEventType.REMOVE);
      const updateEvent = new EventModule.EntityEvent(EntityEventType.UPDATE);

      // 验证事件创建成功
      expect(addEvent).toBeInstanceOf(EventModule.EntityEvent);
      expect(removeEvent).toBeInstanceOf(EventModule.EntityEvent);
      expect(updateEvent).toBeInstanceOf(EventModule.EntityEvent);
    });
  });
});
