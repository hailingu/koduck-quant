/**
 * RuntimeManagerCoordinator Unit Tests
 *
 * @description
 * Test suite for RuntimeManagerCoordinator module.
 * Tests manager registration, initialization, dependency resolution, retry/timeout mechanisms.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RuntimeManagerCoordinator } from "../../../src/common/runtime/runtime-manager-coordinator";
import type { IManager } from "../../../src/common/manager/types";

/**
 * Helper function to create a mock manager
 */
function createMockManager(options: {
  name: string;
  shouldInitialize?: boolean;
  initDelay?: number;
  shouldFail?: boolean;
}): IManager {
  const manager: IManager = {
    name: options.name,
    type: "mock",
    dispose: vi.fn(),
  };

  if (options.shouldInitialize) {
    manager.initialize = vi.fn(async () => {
      if (options.initDelay) {
        await new Promise((resolve) => setTimeout(resolve, options.initDelay));
      }
      if (options.shouldFail) {
        throw new Error(`${options.name} initialization failed`);
      }
    });
  }

  return manager;
}

describe("RuntimeManagerCoordinator", () => {
  let coordinator: RuntimeManagerCoordinator;

  beforeEach(() => {
    coordinator = new RuntimeManagerCoordinator(
      {
        retries: { attempts: 3, delayMs: 10 },
        timeoutMs: 1000,
        warnOnRetry: false,
      },
      ["entity", "render", "registry"]
    );
  });

  describe("Constructor and Initialization", () => {
    it("should successfully create an instance", () => {
      expect(coordinator).toBeDefined();
      expect(coordinator).toBeInstanceOf(RuntimeManagerCoordinator);
    });

    it("should correctly set core Manager keys", () => {
      const mockManager = createMockManager({ name: "entity" });

      // Attempting to register core Manager should be blocked
      coordinator.registerManager("entity", mockManager);

      // Should not be added to registration list
      expect(coordinator.getRegisteredManagers()).not.toContain("entity");
    });
  });

  describe("registerManager() - Register Manager", () => {
    it("should successfully register a Manager", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);

      expect(coordinator.hasManager("spatial")).toBe(true);
      expect(coordinator.getRegisteredManagers()).toContain("spatial");
    });

    it("should prevent duplicate registration", () => {
      const manager1 = createMockManager({ name: "spatial" });
      const manager2 = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager1);
      coordinator.registerManager("spatial", manager2);

      const managers = coordinator.getRegisteredManagers();
      expect(managers.filter((name) => name === "spatial")).toHaveLength(1);
    });

    it("should record dependency relationships", () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, {
        dependencies: ["entity", "render"],
      });

      expect(coordinator.hasManager("spatial")).toBe(true);
    });

    it("should auto-initialize when not lazy loading", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, {
        lazy: false,
      });

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(manager.initialize).toHaveBeenCalled();
    });

    it("should not auto-initialize when lazy loading", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, {
        lazy: true,
      });

      // Wait for a while
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(manager.initialize).not.toHaveBeenCalled();
    });
  });

  describe("unregisterManager() - Unregister Manager", () => {
    it("should successfully unregister a Manager", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);
      expect(coordinator.hasManager("spatial")).toBe(true);

      coordinator.unregisterManager("spatial");
      expect(coordinator.hasManager("spatial")).toBe(false);
    });

    it("should call Manager's dispose method", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);
      coordinator.unregisterManager("spatial");

      expect(manager.dispose).toHaveBeenCalled();
    });

    it("should prevent unregistering core Manager", () => {
      coordinator.unregisterManager("entity");
      // Should not throw error, just blocked
      expect(coordinator.hasManager("entity")).toBe(false);
      expect(coordinator.getRegisteredManagers()).not.toContain("entity");
    });
  });

  describe("getManager() - Get Manager", () => {
    it("should return registered Manager", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);

      const retrieved = coordinator.getManager("spatial");
      expect(retrieved).toBe(manager);
    });

    it("should return undefined when Manager does not exist", () => {
      const manager = coordinator.getManager("nonexistent");
      expect(manager).toBeUndefined();
    });

    it("should trigger lazy initialization on access", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, { lazy: true });

      coordinator.getManager("spatial");

      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(manager.initialize).toHaveBeenCalled();
    });
  });

  describe("initializeManager() - Initialize Manager", () => {
    it("should successfully initialize Manager", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, { lazy: true });

      await coordinator.initializeManager("spatial");

      expect(manager.initialize).toHaveBeenCalled();
      expect(coordinator.getInitializedManagers()).toContain("spatial");
    });

    it("should throw an error when Manager does not exist", async () => {
      await expect(coordinator.initializeManager("nonexistent")).rejects.toThrow();
    });

    it("should throw an error when initialization fails", async () => {
      const manager = createMockManager({
        name: "spatial",
        shouldInitialize: true,
        shouldFail: true,
      });

      coordinator.registerManager("spatial", manager, { lazy: true });

      await expect(coordinator.initializeManager("spatial")).rejects.toThrow();
    });

    it("should support retry mechanism", async () => {
      let attempts = 0;
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });
      manager.initialize = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Temporary failure");
        }
      });

      coordinator.registerManager("spatial", manager, {
        lazy: true,
        initialization: {
          retries: { attempts: 3, delayMs: 10 },
        },
      });

      await coordinator.initializeManager("spatial");

      expect(manager.initialize).toHaveBeenCalledTimes(3);
      expect(coordinator.getInitializedManagers()).toContain("spatial");
    });

    it("should complete successfully when no initialize method", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: false });

      coordinator.registerManager("spatial", manager, { lazy: true });

      await coordinator.initializeManager("spatial");

      expect(coordinator.getInitializedManagers()).toContain("spatial");
    });

    it("should avoid duplicate initialization", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, { lazy: true });

      await coordinator.initializeManager("spatial");
      await coordinator.initializeManager("spatial");

      expect(manager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe("Dependency Resolution", () => {
    it("should resolve single dependency before initialization", async () => {
      const dep = createMockManager({ name: "dependency", shouldInitialize: true });
      const target = createMockManager({ name: "target", shouldInitialize: true });

      coordinator.registerManager("dependency", dep, { lazy: true });
      coordinator.registerManager("target", target, {
        dependencies: ["dependency"],
        lazy: true,
      });

      await coordinator.initializeManager("target");

      expect(coordinator.getInitializedManagers()).toContain("dependency");
      expect(coordinator.getInitializedManagers()).toContain("target");
    });

    it("should resolve multiple dependencies before initialization", async () => {
      const dep1 = createMockManager({ name: "dep1", shouldInitialize: true });
      const dep2 = createMockManager({ name: "dep2", shouldInitialize: true });
      const target = createMockManager({ name: "target", shouldInitialize: true });

      coordinator.registerManager("dep1", dep1, { lazy: true });
      coordinator.registerManager("dep2", dep2, { lazy: true });
      coordinator.registerManager("target", target, {
        dependencies: ["dep1", "dep2"],
        lazy: true,
      });

      await coordinator.initializeManager("target");

      expect(coordinator.getInitializedManagers()).toContain("dep1");
      expect(coordinator.getInitializedManagers()).toContain("dep2");
      expect(coordinator.getInitializedManagers()).toContain("target");
    });

    it("should detect and prevent circular dependencies", async () => {
      const a = createMockManager({ name: "a", shouldInitialize: true });
      const b = createMockManager({ name: "b", shouldInitialize: true });

      coordinator.registerManager("a", a, { dependencies: ["b"], lazy: true });
      coordinator.registerManager("b", b, { dependencies: ["a"], lazy: true });

      try {
        await coordinator.initializeManager("a");
        expect.fail("Expected circular dependency error");
      } catch (error) {
        // Circular dependency error should be in cause
        expect(error).toBeInstanceOf(Error);
        const err = error as Error & { cause?: Error };
        expect(err.message).toContain("dependency 'b' failed to initialize");
        expect(err.cause).toBeDefined();
        expect(err.cause?.message).toMatch(/circular dependency/i);
      }
    });

    it("should throw an error when dependency is missing", async () => {
      const target = createMockManager({ name: "target", shouldInitialize: true });

      coordinator.registerManager("target", target, {
        dependencies: ["missing"],
        lazy: true,
      });

      await expect(coordinator.initializeManager("target")).rejects.toThrow(/missing dependency/i);
    });
  });

  describe("dispose() - Release Resources", () => {
    it("should release all registered Managers", () => {
      const manager1 = createMockManager({ name: "m1" });
      const manager2 = createMockManager({ name: "m2" });

      coordinator.registerManager("m1", manager1);
      coordinator.registerManager("m2", manager2);

      coordinator.dispose();

      expect(manager1.dispose).toHaveBeenCalled();
      expect(manager2.dispose).toHaveBeenCalled();
    });

    it("should clear all internal mappings", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);
      coordinator.dispose();

      expect(coordinator.getRegisteredManagers()).toHaveLength(0);
      expect(coordinator.getInitializedManagers()).toHaveLength(0);
    });
  });

  describe("getManagerInitializationDefaults()", () => {
    it("should return default initialization config", () => {
      const defaults = coordinator.getManagerInitializationDefaults();

      expect(defaults).toHaveProperty("retries");
      expect(defaults.retries).toHaveProperty("attempts");
      expect(defaults.retries).toHaveProperty("delayMs");
      expect(defaults).toHaveProperty("warnOnRetry");
    });
  });
});
