import { describe, test, expect } from "vitest";
import * as EventModule from "../../src/common/event/index";

describe("Event Module Index", () => {
  describe("Core Event Infrastructure", () => {
    test("should export BaseEvent", () => {
      expect(EventModule.BaseEvent).toBeDefined();
      expect(typeof EventModule.BaseEvent).toBe("function");
    });

    test("should export GenericEvent", () => {
      expect(EventModule.GenericEvent).toBeDefined();
      expect(typeof EventModule.GenericEvent).toBe("function");
    });

    test("should export createEmitter", () => {
      expect(EventModule.createEmitter).toBeDefined();
      expect(typeof EventModule.createEmitter).toBe("function");
    });

    test("BaseEvent should be instantiable", () => {
      // Since BaseEvent is abstract, we test via GenericEvent
      const event = new EventModule.GenericEvent("test");
      expect(event).toBeInstanceOf(EventModule.BaseEvent);
    });

    test("createEmitter should return a GenericEvent instance", () => {
      const emitter = EventModule.createEmitter<string>("test");
      expect(emitter).toBeInstanceOf(EventModule.GenericEvent);
      expect(emitter).toBeInstanceOf(EventModule.BaseEvent);
    });
  });

  describe("Entity Events", () => {
    test("should export EntityEvent", () => {
      expect(EventModule.EntityEvent).toBeDefined();
      expect(typeof EventModule.EntityEvent).toBe("function");
    });

    test("should export EntityAddEvent", () => {
      expect(EventModule.EntityAddEvent).toBeDefined();
      expect(typeof EventModule.EntityAddEvent).toBe("function");
    });

    test("should export EntityRemoveEvent", () => {
      expect(EventModule.EntityRemoveEvent).toBeDefined();
      expect(typeof EventModule.EntityRemoveEvent).toBe("function");
    });

    test("should export EntityUpdateEvent", () => {
      expect(EventModule.EntityUpdateEvent).toBeDefined();
      expect(typeof EventModule.EntityUpdateEvent).toBe("function");
    });

    test("should export EntityEventType", () => {
      expect(EventModule.EntityEventType).toBeDefined();
      expect(typeof EventModule.EntityEventType).toBe("object");
    });

    test("EntityEventType should contain correct values", () => {
      expect(EventModule.EntityEventType.ADD).toBe("EntityAdd");
      expect(EventModule.EntityEventType.REMOVE).toBe("EntityRemove");
      expect(EventModule.EntityEventType.UPDATE).toBe("EntityUpdate");
    });

    test("should be able to instantiate EntityEvent", () => {
      const entityEvent = new EventModule.EntityEvent(EventModule.EntityEventType.ADD);
      expect(entityEvent).toBeInstanceOf(EventModule.EntityEvent);
    });

    test("should be able to instantiate EntityAddEvent", () => {
      const addEvent = new EventModule.EntityAddEvent();
      expect(addEvent).toBeInstanceOf(EventModule.EntityAddEvent);
      expect(addEvent).toBeInstanceOf(EventModule.EntityEvent);
    });

    test("should be able to instantiate EntityRemoveEvent", () => {
      const removeEvent = new EventModule.EntityRemoveEvent();
      expect(removeEvent).toBeInstanceOf(EventModule.EntityRemoveEvent);
      expect(removeEvent).toBeInstanceOf(EventModule.EntityEvent);
    });

    test("should be able to instantiate EntityUpdateEvent", () => {
      const updateEvent = new EventModule.EntityUpdateEvent();
      expect(updateEvent).toBeInstanceOf(EventModule.EntityUpdateEvent);
      expect(updateEvent).toBeInstanceOf(EventModule.EntityEvent);
    });
  });

  describe("Event Managers", () => {
    test("should export EventManager", () => {
      expect(EventModule.EventManager).toBeDefined();
      expect(typeof EventModule.EventManager).toBe("function");
    });

    test("should export EntityEventManager", () => {
      expect(EventModule.EntityEventManager).toBeDefined();
      expect(typeof EventModule.EntityEventManager).toBe("function");
    });

    test("should export createEntityEventManager", () => {
      expect(EventModule.createEntityEventManager).toBeDefined();
      expect(typeof EventModule.createEntityEventManager).toBe("function");
    });

    test("should be able to instantiate EventManager", () => {
      const manager = new EventModule.EventManager();
      expect(manager).toBeInstanceOf(EventModule.EventManager);
    });

    test("createEntityEventManager should return independent instances", () => {
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
    test("should export EventBus", () => {
      expect(EventModule.EventBus).toBeDefined();
      expect(typeof EventModule.EventBus).toBe("function");
    });

    test("should export createEventBus", () => {
      expect(EventModule.createEventBus).toBeDefined();
      expect(typeof EventModule.createEventBus).toBe("function");
    });

    test("should export LoggingEvent", () => {
      expect(EventModule.LoggingEvent).toBeDefined();
      expect(typeof EventModule.LoggingEvent).toBe("function");
    });

    test("should export SystemEventBus", () => {
      expect(EventModule.SystemEventBus).toBeDefined();
      expect(typeof EventModule.SystemEventBus).toBe("function");
    });

    test("createEventBus should return a new EventBus instance", () => {
      const bus1 = EventModule.createEventBus();
      const bus2 = EventModule.createEventBus();

      expect(bus1).toBeInstanceOf(EventModule.EventBus);
      expect(bus2).toBeInstanceOf(EventModule.EventBus);
      expect(bus1).not.toBe(bus2);

      bus1.dispose();
      bus2.dispose();
    });

    test("should be able to instantiate LoggingEvent", () => {
      const loggingEvent = new EventModule.LoggingEvent();
      expect(loggingEvent).toBeInstanceOf(EventModule.LoggingEvent);
      expect(loggingEvent).toBeInstanceOf(EventModule.BaseEvent);
    });

    test("should be able to instantiate SystemEventBus", () => {
      const systemEventBus = new EventModule.SystemEventBus();
      expect(systemEventBus).toBeInstanceOf(EventModule.SystemEventBus);
      expect(systemEventBus).toBeInstanceOf(EventModule.BaseEvent);
    });
  });

  describe("Render Event Manager", () => {
    test("should export RenderEventManager", () => {
      expect(EventModule.RenderEventManager).toBeDefined();
      expect(typeof EventModule.RenderEventManager).toBe("function");
    });

    test("should export createRenderEventManager", () => {
      expect(EventModule.createRenderEventManager).toBeDefined();
      expect(typeof EventModule.createRenderEventManager).toBe("function");
    });

    test("createRenderEventManager should return independent instances", () => {
      const renderManager1 = EventModule.createRenderEventManager();
      const renderManager2 = EventModule.createRenderEventManager();

      expect(renderManager1).toBeInstanceOf(EventModule.RenderEventManager);
      expect(renderManager2).toBeInstanceOf(EventModule.RenderEventManager);
      expect(renderManager1).not.toBe(renderManager2);
    });
  });

  describe("Module Structure", () => {
    test("should export all expected members", () => {
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

    test("should not export unexpected members", () => {
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

      // Check for unexpected exports
      const unexpectedExports = actualExports.filter(
        (exportName) => !expectedExports.includes(exportName)
      );

      expect(unexpectedExports).toEqual([]);
    });

    test("all exports should be available", () => {
      Object.keys(EventModule).forEach((exportName) => {
        const exportValue = EventModule[exportName as keyof typeof EventModule];
        expect(exportValue).toBeDefined();
        expect(exportValue).not.toBeNull();
      });
    });
  });

  describe("Integration Tests", () => {
    test("should support a complete event system workflow", () => {
      // Create base event
      const genericEvent = new EventModule.GenericEvent<string>("integration-test");

      // Create entity event
      const entityAdd = new EventModule.EntityAddEvent();

      // Get manager instances
      const eventBus = EventModule.createEventBus();
      const entityManager = EventModule.createEntityEventManager();
      const renderManager = EventModule.createRenderEventManager();

      // Verify all components work correctly
      expect(genericEvent).toBeInstanceOf(EventModule.BaseEvent);
      expect(entityAdd).toBeInstanceOf(EventModule.EntityEvent);
      expect(eventBus).toBeInstanceOf(EventModule.EventBus);
      expect(entityManager).toBeInstanceOf(EventModule.EntityEventManager);
      expect(renderManager).toBeInstanceOf(EventModule.RenderEventManager);

      // Cleanup
      eventBus.dispose();
      entityManager.dispose();
      genericEvent.dispose();
    });

    test("should support event type checking", () => {
      // Test whether the type system works correctly
      const emitter = EventModule.createEmitter<number>("number-test");
      const listener = (value: number) => {
        expect(typeof value).toBe("number");
      };

      emitter.addEventListener(listener);
      emitter.fire(42);

      emitter.dispose();
    });

    test("should support entity event type enum", () => {
      const { EntityEventType } = EventModule;

      // Verify enum values
      expect(EntityEventType.ADD).toBe("EntityAdd");
      expect(EntityEventType.REMOVE).toBe("EntityRemove");
      expect(EntityEventType.UPDATE).toBe("EntityUpdate");

      // Verify enum can be used for event creation
      const addEvent = new EventModule.EntityEvent(EntityEventType.ADD);
      const removeEvent = new EventModule.EntityEvent(EntityEventType.REMOVE);
      const updateEvent = new EventModule.EntityEvent(EntityEventType.UPDATE);

      // Verify event creation succeeded
      expect(addEvent).toBeInstanceOf(EventModule.EntityEvent);
      expect(removeEvent).toBeInstanceOf(EventModule.EntityEvent);
      expect(updateEvent).toBeInstanceOf(EventModule.EntityEvent);
    });
  });
});
