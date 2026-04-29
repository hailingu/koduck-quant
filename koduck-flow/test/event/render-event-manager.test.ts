import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  RenderEventManager,
  createRenderEventManager,
  type RenderAllPayload,
  type RenderEntitiesPayload,
  type ViewportChangedPayload,
} from "../../src/common/event/render-event-manager";

describe("RenderEventManager", () => {
  let renderManager: RenderEventManager;

  beforeEach(() => {
    renderManager = createRenderEventManager();
  });

  describe("Instance creation", () => {
    test("should export creation function", () => {
      expect(createRenderEventManager).toBeDefined();
      expect(typeof createRenderEventManager).toBe("function");
    });

    test("createRenderEventManager returns independent instances on each call", () => {
      const instance1 = createRenderEventManager();
      const instance2 = createRenderEventManager();

      expect(instance1).toBeInstanceOf(RenderEventManager);
      expect(instance2).toBeInstanceOf(RenderEventManager);
      expect(instance1).not.toBe(instance2);

      instance1.requestRenderAll({ reason: "sanity" });
      instance2.requestRenderAll({ reason: "sanity" });
    });

    test("still supports direct instantiation", () => {
      const instance = new RenderEventManager();
      expect(instance).toBeInstanceOf(RenderEventManager);
    });
  });

  describe("RenderAll Events", () => {
    test("should correctly subscribe to renderAll events", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onRenderAll(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    test("should correctly trigger renderAll events", () => {
      const listener = vi.fn();
      renderManager.onRenderAll(listener);

      const payload: RenderAllPayload = {
        reason: "test render",
        hints: {
          onlyEntities: ["entity1", "entity2"],
          onlyLayers: ["layer1"],
        },
      };

      renderManager.requestRenderAll(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("should handle renderAll requests with empty payload", () => {
      const listener = vi.fn();
      renderManager.onRenderAll(listener);

      renderManager.requestRenderAll();

      expect(listener).toHaveBeenCalledWith({});
    });

    test("should correctly handle undefined payload", () => {
      const listener = vi.fn();
      renderManager.onRenderAll(listener);

      renderManager.requestRenderAll(undefined);

      expect(listener).toHaveBeenCalledWith({});
    });

    test("should support multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      renderManager.onRenderAll(listener1);
      renderManager.onRenderAll(listener2);

      const payload: RenderAllPayload = { reason: "multi-listener test" };
      renderManager.requestRenderAll(payload);

      expect(listener1).toHaveBeenCalledWith(payload);
      expect(listener2).toHaveBeenCalledWith(payload);
    });

    test("should support unsubscribing", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onRenderAll(listener);

      unsubscribe();
      renderManager.requestRenderAll({ reason: "after unsubscribe" });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("RenderEntities Events", () => {
    test("should correctly subscribe to renderEntities events", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onRenderEntities(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    test("should correctly trigger renderEntities events", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: ["entity1", "entity2"],
        reason: "entity update",
        op: "render",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("should deduplicate entityIds", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: ["entity1", "entity2", "entity1", "entity3", "entity2"],
        reason: "duplicate test",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).toHaveBeenCalledWith({
        ...payload,
        entityIds: ["entity1", "entity2", "entity3"],
      });
    });

    test("should handle empty entityIds array", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: [],
        reason: "empty array test",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).not.toHaveBeenCalled();
    });

    test("should handle invalid payload", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      // Test null payload
       
      renderManager.requestRenderEntities(null as any);
      expect(listener).not.toHaveBeenCalled();

      // Test undefined payload
       
      renderManager.requestRenderEntities(undefined as any);
      expect(listener).not.toHaveBeenCalled();

      // Test non-array entityIds
      renderManager.requestRenderEntities({
         
        entityIds: "not-an-array" as any,
        reason: "invalid test",
      });
      expect(listener).not.toHaveBeenCalled();
    });

    test("should support remove operation", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: ["entity1"],
        reason: "remove test",
        op: "remove",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("should default to render operation", () => {
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      const payload: RenderEntitiesPayload = {
        entityIds: ["entity1"],
        reason: "default op test",
      };

      renderManager.requestRenderEntities(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("should support unsubscribing", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onRenderEntities(listener);

      unsubscribe();
      renderManager.requestRenderEntities({
        entityIds: ["entity1"],
        reason: "after unsubscribe",
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("ViewportChanged Events", () => {
    test("should correctly subscribe to viewportChanged events", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onViewportChanged(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    test("should correctly trigger viewportChanged events", () => {
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      const payload: ViewportChangedPayload = {
        x: 100,
        y: 200,
        zoom: 1.5,
        size: { w: 800, h: 600 },
      };

      renderManager.notifyViewportChanged(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("should handle viewport changes without size", () => {
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      const payload: ViewportChangedPayload = {
        x: 50,
        y: 75,
        zoom: 2.0,
      };

      renderManager.notifyViewportChanged(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("should support negative coordinates", () => {
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      const payload: ViewportChangedPayload = {
        x: -100,
        y: -200,
        zoom: 0.5,
      };

      renderManager.notifyViewportChanged(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("should support zero zoom", () => {
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      const payload: ViewportChangedPayload = {
        x: 0,
        y: 0,
        zoom: 0,
      };

      renderManager.notifyViewportChanged(payload);

      expect(listener).toHaveBeenCalledWith(payload);
    });

    test("should support unsubscribing", () => {
      const listener = vi.fn();
      const unsubscribe = renderManager.onViewportChanged(listener);

      unsubscribe();
      renderManager.notifyViewportChanged({
        x: 0,
        y: 0,
        zoom: 1,
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("Event Integration", () => {
    test("should support multiple events working simultaneously", () => {
      const renderAllListener = vi.fn();
      const renderEntitiesListener = vi.fn();
      const viewportListener = vi.fn();

      renderManager.onRenderAll(renderAllListener);
      renderManager.onRenderEntities(renderEntitiesListener);
      renderManager.onViewportChanged(viewportListener);

      // Trigger all types of events
      renderManager.requestRenderAll({ reason: "integration test" });
      renderManager.requestRenderEntities({
        entityIds: ["entity1"],
        reason: "integration test",
      });
      renderManager.notifyViewportChanged({
        x: 100,
        y: 100,
        zoom: 1.0,
      });

      expect(renderAllListener).toHaveBeenCalledTimes(1);
      expect(renderEntitiesListener).toHaveBeenCalledTimes(1);
      expect(viewportListener).toHaveBeenCalledTimes(1);
    });

    test("should correctly handle complex rendering scenarios", () => {
      const renderAllListener = vi.fn();
      const renderEntitiesListener = vi.fn();

      renderManager.onRenderAll(renderAllListener);
      renderManager.onRenderEntities(renderEntitiesListener);

      // Complex rendering scenario
      renderManager.requestRenderAll({
        reason: "complex scenario",
        hints: {
          onlyEntities: ["entity1", "entity2", "entity3"],
          onlyLayers: ["layer1", "layer2"],
        },
      });

      renderManager.requestRenderEntities({
        entityIds: ["entity4", "entity5", "entity4"], // Contains duplicates
        reason: "complex entities",
        op: "render",
      });

      expect(renderAllListener).toHaveBeenCalledWith({
        reason: "complex scenario",
        hints: {
          onlyEntities: ["entity1", "entity2", "entity3"],
          onlyLayers: ["layer1", "layer2"],
        },
      });

      expect(renderEntitiesListener).toHaveBeenCalledWith({
        entityIds: ["entity4", "entity5"], // Duplicates removed
        reason: "complex entities",
        op: "render",
      });
    });

    test("should correctly handle mixed event unsubscription scenarios", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      const unsubscribe1 = renderManager.onRenderAll(listener1);
      const unsubscribe2 = renderManager.onRenderEntities(listener2);
      const unsubscribe3 = renderManager.onViewportChanged(listener3);

      // Unsubscribe partially
      unsubscribe2();

      // Trigger all events
      renderManager.requestRenderAll({ reason: "mixed unsubscribe test" });
      renderManager.requestRenderEntities({
        entityIds: ["entity1"],
        reason: "mixed unsubscribe test",
      });
      renderManager.notifyViewportChanged({
        x: 0,
        y: 0,
        zoom: 1,
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled(); // Already unsubscribed
      expect(listener3).toHaveBeenCalledTimes(1);

      // Clean up remaining subscriptions
      unsubscribe1();
      unsubscribe3();
    });
  });

  describe("Type Aliases", () => {
    test("should correctly export type aliases", () => {
      // These type aliases should be available at compile time
      // We test them by actual usage
      const renderAllEvent: import("../../src/common/event/render-event-manager").RenderAllEvent =
        {
          reason: "type alias test",
        };

      const renderEntitiesEvent: import("../../src/common/event/render-event-manager").RenderEntitiesEvent =
        {
          entityIds: ["entity1"],
          op: "render",
        };

      expect(renderAllEvent.reason).toBe("type alias test");
      expect(renderEntitiesEvent.entityIds).toEqual(["entity1"]);
    });
  });

  describe("Event Configuration", () => {
    test("should disable batching for renderAll", () => {
      // Since private fields cannot be accessed directly, we test via behavior
      // renderAll should trigger immediately without batching delay
      const listener = vi.fn();
      renderManager.onRenderAll(listener);

      renderManager.requestRenderAll({ reason: "immediate test" });

      // Check immediately, should have been called
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test("should enable batching for renderEntities", async () => {
      // renderEntities is configured with batching: batchSize: 200, batchInterval: 16ms
      const listener = vi.fn();
      renderManager.onRenderEntities(listener);

      // Rapidly send multiple requests
      for (let i = 0; i < 5; i++) {
        renderManager.requestRenderEntities({
          entityIds: [`entity${i}`],
          reason: `batch test ${i}`,
        });
      }

      // Due to batching, listener may not have been called yet or called in batch
      // Here we verify it will be called at least once
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(listener).toHaveBeenCalled();
    });

    test("should enable batching for viewportChanged", async () => {
      // viewportChanged is configured with batching: batchSize: 1, batchInterval: 16ms
      const listener = vi.fn();
      renderManager.onViewportChanged(listener);

      // Rapidly send multiple viewport changes
      for (let i = 0; i < 3; i++) {
        renderManager.notifyViewportChanged({
          x: i * 10,
          y: i * 10,
          zoom: 1 + i * 0.1,
        });
      }

      // Wait for batch interval
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(listener).toHaveBeenCalled();
    });
  });
});
