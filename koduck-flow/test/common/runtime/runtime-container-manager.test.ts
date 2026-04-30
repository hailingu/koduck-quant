/**
 * RuntimeContainerManager Unit Tests
 *
 * @description
 * Test all functions of the container manager to ensure service resolution, core service access, and lifecycle management work correctly.
 *
 * @coverage
 * - Constructor and initialization
 * - Service resolution (resolve, has)
 * - Core service access (getCoreManagers, get*Manager)
 * - Lifecycle management (dispose)
 * - Error handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RuntimeContainerManager,
  registerRuntimeInstance,
} from "../../../src/common/runtime/runtime-container-manager";
import { createCoreContainer } from "../../../src/common/di/bootstrap";
import type { IDependencyContainer } from "../../../src/common/di/types";
import { TOKENS } from "../../../src/common/di/tokens";

describe("RuntimeContainerManager", () => {
  let container: IDependencyContainer;
  let containerManager: RuntimeContainerManager;

  beforeEach(() => {
    container = createCoreContainer();
    containerManager = new RuntimeContainerManager(container);
  });

  describe("Constructor and Initialization", () => {
    it("should successfully create an instance", () => {
      expect(containerManager).toBeDefined();
      expect(containerManager.container).toBe(container);
    });

    it("should resolve and cache all core services during construction", () => {
      const coreManagers = containerManager.getCoreManagers();

      expect(coreManagers.entity).toBeDefined();
      expect(coreManagers.render).toBeDefined();
      expect(coreManagers.registry).toBeDefined();
      expect(coreManagers.eventBus).toBeDefined();
      expect(coreManagers.renderEvents).toBeDefined();
      expect(coreManagers.entityEvents).toBeDefined();
    });

    it("should throw an error when container is null", () => {
      expect(() => new RuntimeContainerManager(null as unknown as IDependencyContainer)).toThrow(
        "Container cannot be null or undefined"
      );
    });

    it("should throw an error when container is undefined", () => {
      expect(
        () => new RuntimeContainerManager(undefined as unknown as IDependencyContainer)
      ).toThrow("Container cannot be null or undefined");
    });
  });

  describe("resolve() - Service Resolution", () => {
    it("should successfully resolve registered services", () => {
      const entityManager = containerManager.resolve(TOKENS.entityManager);
      expect(entityManager).toBeDefined();
    });

    it("should be able to resolve core services", () => {
      const renderManager = containerManager.resolve(TOKENS.renderManager);
      const registryManager = containerManager.resolve(TOKENS.registryManager);
      const eventBus = containerManager.resolve(TOKENS.eventBus);

      expect(renderManager).toBeDefined();
      expect(registryManager).toBeDefined();
      expect(eventBus).toBeDefined();
    });

    it("resolve() should throw an error when container is disposed", () => {
      containerManager.dispose();
      const fn = () => containerManager.resolve(TOKENS.entityManager);
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });

    it("resolve() should throw an error when service is not registered", () => {
      const fn = () => containerManager.resolve("non-existent-service");
      expect(fn).toThrow();
    });
  });

  describe("has() - Service Check", () => {
    it("should return true for registered services", () => {
      expect(containerManager.has(TOKENS.entityManager)).toBe(true);
      expect(containerManager.has(TOKENS.renderManager)).toBe(true);
      expect(containerManager.has(TOKENS.registryManager)).toBe(true);
    });

    it("should return false for unregistered services", () => {
      expect(containerManager.has("non-existent-service")).toBe(false);
    });

    it("has() should throw an error when container is disposed", () => {
      containerManager.dispose();
      const fn = () => containerManager.has(TOKENS.entityManager);
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getCoreManagers() - Batch Access to Core Services", () => {
    it("should return all core managers", () => {
      const coreManagers = containerManager.getCoreManagers();

      expect(coreManagers).toBeDefined();
      expect(coreManagers.entity).toBeDefined();
      expect(coreManagers.render).toBeDefined();
      expect(coreManagers.registry).toBeDefined();
      expect(coreManagers.eventBus).toBeDefined();
      expect(coreManagers.renderEvents).toBeDefined();
      expect(coreManagers.entityEvents).toBeDefined();
    });

    it("should return cached instances", () => {
      const coreManagers1 = containerManager.getCoreManagers();
      const coreManagers2 = containerManager.getCoreManagers();

      expect(coreManagers1.entity).toBe(coreManagers2.entity);
      expect(coreManagers1.render).toBe(coreManagers2.render);
      expect(coreManagers1.registry).toBe(coreManagers2.registry);
    });

    it("getCoreManagers() should throw an error when container is disposed", () => {
      containerManager.dispose();
      const fn = () => containerManager.getCoreManagers();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getEntityManager() - Single Service Access", () => {
    it("should return the entity manager", () => {
      const entityManager = containerManager.getEntityManager();
      expect(entityManager).toBeDefined();
    });

    it("should return the same instance as getCoreManagers()", () => {
      const entityManager = containerManager.getEntityManager();
      const coreManagers = containerManager.getCoreManagers();
      expect(entityManager).toBe(coreManagers.entity);
    });

    it("getEntityManager() should throw an error when container is disposed", () => {
      containerManager.dispose();
      const fn = () => containerManager.getEntityManager();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getRenderManager() - Single Service Access", () => {
    it("should return the render manager", () => {
      const renderManager = containerManager.getRenderManager();
      expect(renderManager).toBeDefined();
    });

    it("should return the same instance as getCoreManagers()", () => {
      const renderManager = containerManager.getRenderManager();
      const coreManagers = containerManager.getCoreManagers();
      expect(renderManager).toBe(coreManagers.render);
    });

    it("getRenderManager() should throw an error when container is disposed", () => {
      containerManager.dispose();
      const fn = () => containerManager.getRenderManager();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getRegistryManager() - Single Service Access", () => {
    it("should return the registry manager", () => {
      const registryManager = containerManager.getRegistryManager();
      expect(registryManager).toBeDefined();
    });

    it("should return the same instance as getCoreManagers()", () => {
      const registryManager = containerManager.getRegistryManager();
      const coreManagers = containerManager.getCoreManagers();
      expect(registryManager).toBe(coreManagers.registry);
    });

    it("getRegistryManager() should throw an error when container is disposed", () => {
      containerManager.dispose();
      const fn = () => containerManager.getRegistryManager();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getEventBus() - Single Service Access", () => {
    it("should return the event bus", () => {
      const eventBus = containerManager.getEventBus();
      expect(eventBus).toBeDefined();
    });

    it("should return the same instance as getCoreManagers()", () => {
      const eventBus = containerManager.getEventBus();
      const coreManagers = containerManager.getCoreManagers();
      expect(eventBus).toBe(coreManagers.eventBus);
    });

    it("getEventBus() should throw an error when container is disposed", () => {
      containerManager.dispose();
      const fn = () => containerManager.getEventBus();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getRenderEvents() - Single Service Access", () => {
    it("should return the render event manager", () => {
      const renderEvents = containerManager.getRenderEvents();
      expect(renderEvents).toBeDefined();
    });

    it("should return the same instance as getCoreManagers()", () => {
      const renderEvents = containerManager.getRenderEvents();
      const coreManagers = containerManager.getCoreManagers();
      expect(renderEvents).toBe(coreManagers.renderEvents);
    });

    it("getRenderEvents() should throw an error when container is disposed", () => {
      containerManager.dispose();
      const fn = () => containerManager.getRenderEvents();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getEntityEvents() - Single Service Access", () => {
    it("should return the entity event manager", () => {
      const entityEvents = containerManager.getEntityEvents();
      expect(entityEvents).toBeDefined();
    });

    it("should return the same instance as getCoreManagers()", () => {
      const entityEvents = containerManager.getEntityEvents();
      const coreManagers = containerManager.getCoreManagers();
      expect(entityEvents).toBe(coreManagers.entityEvents);
    });

    it("getEntityEvents() should throw an error when container is disposed", () => {
      containerManager.dispose();
      const fn = () => containerManager.getEntityEvents();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("dispose() - Lifecycle Management", () => {
    it("should successfully release resources", () => {
      const fn = () => containerManager.dispose();
      expect(fn).not.toThrow();
    });

    it("should clean up core manager cache", () => {
      const coreManagers = containerManager.getCoreManagers();
      expect(coreManagers.entity).toBeDefined();
      containerManager.dispose();

      // Returned snapshots stay stable, while the manager rejects access after disposal.
      expect(coreManagers.entity).toBeDefined();
      expect(() => containerManager.getCoreManagers()).toThrow(
        "RuntimeContainerManager has been disposed"
      );
    });

    it("should not throw when dispose() is called multiple times", () => {
      containerManager.dispose();
      const fn1 = () => containerManager.dispose();
      const fn2 = () => containerManager.dispose();
      expect(fn1).not.toThrow();
      expect(fn2).not.toThrow();
    });

    it("should prohibit all operations after disposal", () => {
      containerManager.dispose();

      const fnResolve = () => containerManager.resolve(TOKENS.entityManager);
      const fnHas = () => containerManager.has(TOKENS.entityManager);
      const fnGetCore = () => containerManager.getCoreManagers();
      const fnEntity = () => containerManager.getEntityManager();
      const fnRender = () => containerManager.getRenderManager();
      const fnRegistry = () => containerManager.getRegistryManager();
      const fnEventBus = () => containerManager.getEventBus();
      const fnRenderEvents = () => containerManager.getRenderEvents();
      const fnEntityEvents = () => containerManager.getEntityEvents();

      expect(fnResolve).toThrow();
      expect(fnHas).toThrow();
      expect(fnGetCore).toThrow();
      expect(fnEntity).toThrow();
      expect(fnRender).toThrow();
      expect(fnRegistry).toThrow();
      expect(fnEventBus).toThrow();
      expect(fnRenderEvents).toThrow();
      expect(fnEntityEvents).toThrow();
    });
  });
});

describe("registerRuntimeInstance()", () => {
  let container: IDependencyContainer;
  let mockRuntime: { id: string };

  beforeEach(() => {
    container = createCoreContainer();
    mockRuntime = { id: "test-runtime" };
  });

  it("should successfully register runtime instance", () => {
    registerRuntimeInstance(container, mockRuntime);

    const registeredRuntime = container.resolve(TOKENS.runtime);
    expect(registeredRuntime).toBe(mockRuntime);
  });

  it("should register tenant context placeholder", () => {
    registerRuntimeInstance(container, mockRuntime);

    expect(container.has(TOKENS.tenantContext)).toBe(true);
    expect(container.resolve(TOKENS.tenantContext)).toBeNull();
  });

  it("should register tenant quota placeholder", () => {
    registerRuntimeInstance(container, mockRuntime);

    expect(container.has(TOKENS.tenantQuota)).toBe(true);
    expect(container.resolve(TOKENS.tenantQuota)).toBeNull();
  });

  it("should register tenant rollout placeholder", () => {
    registerRuntimeInstance(container, mockRuntime);

    expect(container.has(TOKENS.tenantRollout)).toBe(true);
    expect(container.resolve(TOKENS.tenantRollout)).toBeNull();
  });

  it("should allow replacing existing runtime instance", () => {
    const runtime1 = { id: "runtime-1" };
    const runtime2 = { id: "runtime-2" };

    registerRuntimeInstance(container, runtime1);
    registerRuntimeInstance(container, runtime2);

    const registeredRuntime = container.resolve(TOKENS.runtime);
    expect(registeredRuntime).toBe(runtime2);
  });
});
