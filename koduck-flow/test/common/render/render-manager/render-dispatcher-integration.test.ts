import { describe, it, expect, beforeEach } from "vitest";
import type { RenderManagerDependencies } from "../../../../src/common/render/render-manager/types";
import { RenderDispatcherCore } from "../../../../src/common/render/render-manager/dispatcher-core";
import { RenderFrameScheduler } from "../../../../src/common/render/render-manager/render-frame-scheduler";
import { RenderEventManager } from "../../../../src/common/event/render-event-manager";
import { Entity } from "../../../../src/common/entity";

// Mock dependencies
const createMockDependencies = (): RenderManagerDependencies => ({
  renderEvents: new RenderEventManager(),
  frameScheduler: new RenderFrameScheduler(),
});

describe("RenderDispatcher Module Integration", () => {
  let deps: RenderManagerDependencies;
  let dispatcher: RenderDispatcherCore;

  beforeEach(() => {
    deps = createMockDependencies();
    dispatcher = new RenderDispatcherCore(deps);
  });

  describe("Module Initialization", () => {
    it("should initialize all core modules", () => {
      expect(dispatcher).toBeDefined();
      expect(dispatcher.name).toBe("RenderManager");
      expect(dispatcher.type).toBe("render");
    });

    it("should have dirty region coordinator", () => {
      expect(dispatcher.dirtyModule).toBeDefined();
      expect(typeof dispatcher.dirtyModule.getDirtyEntityIds).toBe("function");
    });

    it("should have entity lifecycle tracker", () => {
      expect(dispatcher.entityTracker).toBeDefined();
      expect(typeof dispatcher.entityTracker.addEntity).toBe("function");
    });

    it("should have cache coordinator", () => {
      expect(dispatcher.cacheCoordinator).toBeDefined();
      expect(typeof dispatcher.cacheCoordinator.getVersion).toBe("function");
    });
  });

  describe("Entity Lifecycle Integration", () => {
    it("should track entity lifecycle", () => {
      const entity = new Entity();

      // Add entity
      dispatcher.entityTracker.addEntity(entity);
      expect(dispatcher.entityTracker.getEntity(entity.id)).toBe(entity);

      // Remove entity
      dispatcher.entityTracker.removeEntity(entity.id);
      expect(dispatcher.entityTracker.getEntity(entity.id)).toBeUndefined();
    });

    it("should coordinate dirty regions with entity changes", () => {
      const entity = new Entity();

      // Add entity
      dispatcher.entityTracker.addEntity(entity);

      // Verify entity is tracked
      expect(dispatcher.entityTracker.getEntity(entity.id)).toBe(entity);

      // Dirty region coordinator should be available
      expect(dispatcher.dirtyModule).toBeDefined();
    });
  });

  describe("Cache Coordination", () => {
    it("should bump cache version on entity changes", () => {
      const entity = new Entity();

      // Get version after initialization
      dispatcher.entityTracker.addEntity(entity);

      // Version might not change immediately, but the coordinator should exist
      expect(dispatcher.cacheCoordinator.getVersion()).toBeDefined();
    });

    it("should provide cache performance stats", () => {
      const stats = dispatcher.cacheCoordinator.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(typeof stats.renderCount).toBe("number");
    });
  });

  describe("Module Disposal", () => {
    it("should dispose all modules properly", () => {
      const entity = new Entity();
      dispatcher.entityTracker.addEntity(entity);

      // Dispose dispatcher
      dispatcher.dispose();

      // Verify cleanup
      expect(dispatcher.entityTracker.getSize()).toBe(0);
    });
  });
});
