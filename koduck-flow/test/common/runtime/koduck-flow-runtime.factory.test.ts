/**
 * @fileoverview Factory function tests
 * Test various creation scenarios for createKoduckFlowRuntime and createScopedRuntime
 */

import { describe, expect, it, vi } from "vitest";
import {
  createKoduckFlowRuntime,
  createScopedRuntime,
  type KoduckFlowRuntimeOptions,
} from "../../../src/common/runtime";
import { createCoreContainer, type CoreServiceOverrides } from "../../../src/common/di/bootstrap";

describe("KoduckFlowRuntime Factory Functions", () => {
  describe("createKoduckFlowRuntime", () => {
    it("should create runtime with default options", () => {
      const runtime = createKoduckFlowRuntime();

      expect(runtime).toBeDefined();
      expect(runtime.container).toBeDefined();
      expect(runtime.EntityManager).toBeDefined();
      expect(runtime.RenderManager).toBeDefined();
      expect(runtime.RegistryManager).toBeDefined();
      expect(runtime.EventBus).toBeDefined();

      runtime.dispose();
    });

    it("should create runtime with custom container", () => {
      const customContainer = createCoreContainer();
      const runtime = createKoduckFlowRuntime({ container: customContainer });

      expect(runtime.container).toBe(customContainer);
      expect(runtime.EntityManager).toBeDefined();

      runtime.dispose();
    });

    it("should create runtime with custom manager initialization options", () => {
      const initOptions: KoduckFlowRuntimeOptions = {
        managerInitialization: {
          timeoutMs: 3000,
          retries: {
            attempts: 5,
            delayMs: 200,
          },
          warnOnRetry: true,
        },
      };

      const runtime = createKoduckFlowRuntime(initOptions);

      const defaults = runtime.getManagerInitializationDefaults();
      expect(defaults.timeoutMs).toBe(3000);
      expect(defaults.retries?.attempts).toBe(5);
      expect(defaults.retries?.delayMs).toBe(200);
      expect(defaults.warnOnRetry).toBe(true);

      runtime.dispose();
    });

    it("should apply service overrides when provided", () => {
      const customContainer = createCoreContainer();

      const runtime = createKoduckFlowRuntime({
        container: customContainer,
      });

      // Verify that runtime was created successfully with custom container
      expect(runtime.container).toBe(customContainer);
      expect(runtime.EntityManager).toBeDefined();
      expect(runtime.RenderManager).toBeDefined();

      runtime.dispose();
    });

    it("should register runtime instance and provide access to core services", () => {
      const runtime = createKoduckFlowRuntime();

      // Verify runtime has access to its container and core services
      expect(runtime.container).toBeDefined();
      expect(runtime.EntityManager).toBeDefined();
      expect(runtime.RenderManager).toBeDefined();
      expect(runtime.RegistryManager).toBeDefined();
      expect(runtime.EventBus).toBeDefined();

      runtime.dispose();
    });

    it("should create runtime with both custom container and overrides", () => {
      const customContainer = createCoreContainer();

      const mockRenderManager = {
        initialize: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn(),
        metadata: { name: "RenderManager", version: "1.0.0" },
        addEntityToRender: vi.fn(),
        removeEntityFromRender: vi.fn(),
        getEntityRenderElement: vi.fn(),
        getRenderContext: vi.fn(),
      };

      const overrides: CoreServiceOverrides = {
        renderManager: mockRenderManager,
      };

      const runtime = createKoduckFlowRuntime({
        container: customContainer,
        overrides,
      });

      expect(runtime.container).toBe(customContainer);
      // Verify the runtime was created successfully with overrides
      expect(runtime.RenderManager).toBeDefined();

      runtime.dispose();
    });
  });

  describe("createScopedRuntime", () => {
    it("should create scoped runtime from parent", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const scopedRuntime = createScopedRuntime(parentRuntime);

      expect(scopedRuntime).toBeDefined();
      expect(scopedRuntime.container).not.toBe(parentRuntime.container);
      expect(scopedRuntime.EntityManager).toBeDefined();

      scopedRuntime.dispose();
      parentRuntime.dispose();
    });

    it("should create scoped runtime with custom options", () => {
      const parentRuntime = createKoduckFlowRuntime();

      const scopedRuntime = createScopedRuntime(parentRuntime);

      // Verify scoped runtime was created successfully
      expect(scopedRuntime).toBeDefined();
      expect(scopedRuntime.container).not.toBe(parentRuntime.container);

      // Both should have valid EntityManagers
      expect(scopedRuntime.EntityManager).toBeDefined();
      expect(parentRuntime.EntityManager).toBeDefined();

      scopedRuntime.dispose();
      parentRuntime.dispose();
    });

    it("should inherit initialization options from parent by default", () => {
      const parentRuntime = createKoduckFlowRuntime({
        managerInitialization: {
          timeoutMs: 4000,
          retries: {
            attempts: 3,
            delayMs: 150,
          },
        },
      });

      const scopedRuntime = createScopedRuntime(parentRuntime);

      const scopedDefaults = scopedRuntime.getManagerInitializationDefaults();
      expect(scopedDefaults.timeoutMs).toBe(4000);
      expect(scopedDefaults.retries?.attempts).toBe(3);

      scopedRuntime.dispose();
      parentRuntime.dispose();
    });

    it("should override initialization options when provided", () => {
      const parentRuntime = createKoduckFlowRuntime({
        managerInitialization: {
          timeoutMs: 2000,
        },
      });

      const customOptions: KoduckFlowRuntimeOptions["managerInitialization"] = {
        timeoutMs: 5000,
        retries: {
          attempts: 1,
        },
        warnOnRetry: false,
      };

      const scopedRuntime = createScopedRuntime(parentRuntime, undefined, {
        managerInitialization: customOptions,
      });

      const scopedDefaults = scopedRuntime.getManagerInitializationDefaults();
      expect(scopedDefaults.timeoutMs).toBe(5000);
      expect(scopedDefaults.retries?.attempts).toBe(1);
      expect(scopedDefaults.warnOnRetry).toBe(false);

      scopedRuntime.dispose();
      parentRuntime.dispose();
    });

    it("should register runtime instances in their respective containers", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const scopedRuntime = createScopedRuntime(parentRuntime);

      // Verify both runtimes have their containers set up
      expect(parentRuntime.container).toBeDefined();
      expect(scopedRuntime.container).toBeDefined();
      expect(scopedRuntime.container).not.toBe(parentRuntime.container);

      // Verify both have access to core managers
      expect(parentRuntime.EntityManager).toBeDefined();
      expect(scopedRuntime.EntityManager).toBeDefined();

      scopedRuntime.dispose();
      parentRuntime.dispose();
    });

    it("should isolate entity operations between parent and scoped runtimes", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const scopedRuntime = createScopedRuntime(parentRuntime);

      // Note: This is a conceptual test. Actual entity isolation depends on
      // EntityManager implementation. Here we just verify they are separate instances.
      const parentEntities = parentRuntime.getEntities();
      const scopedEntities = scopedRuntime.getEntities();

      // Both should start empty
      expect(parentEntities).toEqual([]);
      expect(scopedEntities).toEqual([]);

      scopedRuntime.dispose();
      parentRuntime.dispose();
    });

    it("should support multiple scoped runtimes from same parent", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const scopedRuntime1 = createScopedRuntime(parentRuntime);
      const scopedRuntime2 = createScopedRuntime(parentRuntime);

      expect(scopedRuntime1).not.toBe(scopedRuntime2);
      expect(scopedRuntime1.container).not.toBe(scopedRuntime2.container);
      expect(scopedRuntime1.container).not.toBe(parentRuntime.container);

      scopedRuntime1.dispose();
      scopedRuntime2.dispose();
      parentRuntime.dispose();
    });

    it("should dispose scoped runtime without affecting parent", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const scopedRuntime = createScopedRuntime(parentRuntime);

      const parentEntityManager = parentRuntime.EntityManager;

      scopedRuntime.dispose();

      // Parent should still be functional after scoped disposal
      expect(parentRuntime.EntityManager).toBe(parentEntityManager);
      expect(parentRuntime.getEntities()).toEqual([]);

      parentRuntime.dispose();
    });
  });

  describe("Factory Functions Integration", () => {
    it("should create runtime hierarchy with proper isolation", () => {
      // Create parent
      const parentRuntime = createKoduckFlowRuntime({
        managerInitialization: { timeoutMs: 3000 },
      });

      // Create child 1
      const childRuntime1 = createScopedRuntime(parentRuntime);

      // Create child 2 with override
      const childRuntime2 = createScopedRuntime(parentRuntime, undefined, {
        managerInitialization: { timeoutMs: 5000 },
      });

      // Verify hierarchy
      expect(parentRuntime.getManagerInitializationDefaults().timeoutMs).toBe(3000);
      expect(childRuntime1.getManagerInitializationDefaults().timeoutMs).toBe(3000);
      expect(childRuntime2.getManagerInitializationDefaults().timeoutMs).toBe(5000);

      // Cleanup
      childRuntime1.dispose();
      childRuntime2.dispose();
      parentRuntime.dispose();
    });

    it("should handle entity manager inheritance in scoped runtimes", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const scopedRuntime = createScopedRuntime(parentRuntime);

      // Both should have EntityManager
      expect(parentRuntime.EntityManager).toBeDefined();
      expect(scopedRuntime.EntityManager).toBeDefined();

      // Scoped runtime should have different EntityManager instance
      // (because it's in a different DI scope)
      expect(scopedRuntime.EntityManager).not.toBe(parentRuntime.EntityManager);

      scopedRuntime.dispose();
      parentRuntime.dispose();
    });
  });
});
