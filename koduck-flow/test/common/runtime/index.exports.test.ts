/**
 * @fileoverview Runtime 导出验证测试
 * 验证所有公共导出都可以正确访问
 */

import { describe, expect, it } from "vitest";

describe("Runtime Module Exports", () => {
  describe("Main Runtime exports", () => {
    it("should export DuckFlowRuntime class", async () => {
      const { DuckFlowRuntime } = await import("../../../src/common/runtime");
      expect(DuckFlowRuntime).toBeDefined();
      expect(typeof DuckFlowRuntime).toBe("function");
    });

    it("should export createDuckFlowRuntime factory", async () => {
      const { createDuckFlowRuntime } = await import("../../../src/common/runtime");
      expect(createDuckFlowRuntime).toBeDefined();
      expect(typeof createDuckFlowRuntime).toBe("function");
    });

    it("should export createScopedRuntime factory", async () => {
      const { createScopedRuntime } = await import("../../../src/common/runtime");
      expect(createScopedRuntime).toBeDefined();
      expect(typeof createScopedRuntime).toBe("function");
    });
  });

  describe("Core module exports", () => {
    it("should export RuntimeContainerManager", async () => {
      const { RuntimeContainerManager } = await import("../../../src/common/runtime");
      expect(RuntimeContainerManager).toBeDefined();
      expect(typeof RuntimeContainerManager).toBe("function");
    });

    it("should export RuntimeManagerCoordinator", async () => {
      const { RuntimeManagerCoordinator } = await import("../../../src/common/runtime");
      expect(RuntimeManagerCoordinator).toBeDefined();
      expect(typeof RuntimeManagerCoordinator).toBe("function");
    });

    it("should export RuntimeTenantContext", async () => {
      const { RuntimeTenantContext } = await import("../../../src/common/runtime");
      expect(RuntimeTenantContext).toBeDefined();
      expect(typeof RuntimeTenantContext).toBe("function");
    });

    it("should export RuntimeQuotaManager", async () => {
      const { RuntimeQuotaManager } = await import("../../../src/common/runtime");
      expect(RuntimeQuotaManager).toBeDefined();
      expect(typeof RuntimeQuotaManager).toBe("function");
    });

    it("should export RuntimeFeatureFlag", async () => {
      const { RuntimeFeatureFlag } = await import("../../../src/common/runtime");
      expect(RuntimeFeatureFlag).toBeDefined();
      expect(typeof RuntimeFeatureFlag).toBe("function");
    });

    it("should export RuntimeDebugConfiguration", async () => {
      const { RuntimeDebugConfiguration } = await import("../../../src/common/runtime");
      expect(RuntimeDebugConfiguration).toBeDefined();
      expect(typeof RuntimeDebugConfiguration).toBe("function");
    });

    it("should export RuntimeEntityOperations", async () => {
      const { RuntimeEntityOperations } = await import("../../../src/common/runtime");
      expect(RuntimeEntityOperations).toBeDefined();
      expect(typeof RuntimeEntityOperations).toBe("function");
    });
  });

  describe("Utility function exports", () => {
    it("should export tenant utils", async () => {
      const { cloneTenantContext, cloneTenantResourceQuotas } = await import(
        "../../../src/common/runtime"
      );
      expect(cloneTenantContext).toBeDefined();
      expect(typeof cloneTenantContext).toBe("function");
      expect(cloneTenantResourceQuotas).toBeDefined();
      expect(typeof cloneTenantResourceQuotas).toBe("function");
    });

    it("should export hash utils", async () => {
      const { hashString, clampPercentage } = await import("../../../src/common/runtime");
      expect(hashString).toBeDefined();
      expect(typeof hashString).toBe("function");
      expect(clampPercentage).toBeDefined();
      expect(typeof clampPercentage).toBe("function");
    });

    it("should export normalizeRuntimeKey", async () => {
      const { normalizeRuntimeKey } = await import("../../../src/common/runtime");
      expect(normalizeRuntimeKey).toBeDefined();
      expect(typeof normalizeRuntimeKey).toBe("function");
    });

    it("should export resolveTenantContext", async () => {
      const { resolveTenantContext } = await import("../../../src/common/runtime");
      expect(resolveTenantContext).toBeDefined();
      expect(typeof resolveTenantContext).toBe("function");
    });

    it("should export debug options utilities", async () => {
      const { DEFAULT_DEBUG_OPTIONS, mergeDebugOptions } = await import(
        "../../../src/common/runtime"
      );
      expect(DEFAULT_DEBUG_OPTIONS).toBeDefined();
      expect(mergeDebugOptions).toBeDefined();
      expect(typeof mergeDebugOptions).toBe("function");
    });
  });

  describe("Factory class exports", () => {
    it("should export DuckFlowRuntimeFactory", async () => {
      const { DuckFlowRuntimeFactory } = await import("../../../src/common/runtime");
      expect(DuckFlowRuntimeFactory).toBeDefined();
      expect(typeof DuckFlowRuntimeFactory).toBe("function");
    });

    it("should export DuckFlowRuntimeController", async () => {
      const { DuckFlowRuntimeController } = await import("../../../src/common/runtime");
      expect(DuckFlowRuntimeController).toBeDefined();
      expect(typeof DuckFlowRuntimeController).toBe("function");
    });
  });

  describe("Type exports", () => {
    it("should export Manager types", async () => {
      // Dynamic import to verify types are exported
      const runtime = await import("../../../src/common/runtime");

      // Verify type exports by checking they can be used
      expect(runtime).toHaveProperty("createDuckFlowRuntime");

      // Types are compile-time only, so we just verify the module exports work
      expect(typeof runtime.createDuckFlowRuntime).toBe("function");
    });

    it("should export Runtime option types", async () => {
      const runtime = await import("../../../src/common/runtime");

      // Verify runtime options work by creating a runtime with options
      const instance = runtime.createDuckFlowRuntime({
        managerInitialization: {
          timeoutMs: 5000,
        },
      });

      expect(instance).toBeDefined();
      instance.dispose();
    });

    it("should export Tenant types", async () => {
      const { resolveTenantContext } = await import("../../../src/common/runtime");

      // Verify tenant types work by using tenant functions
      expect(resolveTenantContext).toBeDefined();
      expect(typeof resolveTenantContext).toBe("function");
    });

    it("should export Debug types", async () => {
      const { DEFAULT_DEBUG_OPTIONS, mergeDebugOptions } = await import(
        "../../../src/common/runtime"
      );

      // Verify debug types work
      expect(DEFAULT_DEBUG_OPTIONS).toBeDefined();
      expect(mergeDebugOptions).toBeDefined();

      const merged = mergeDebugOptions({ enabled: true }, { logLevel: "debug" });
      expect(merged).toBeDefined();
      if (merged) {
        expect(merged.enabled).toBe(true);
        expect(merged.logLevel).toBe("debug");
      }
    });

    it("should export Controller types", async () => {
      const { DuckFlowRuntimeController } = await import("../../../src/common/runtime");

      // Verify controller types work
      expect(DuckFlowRuntimeController).toBeDefined();
      expect(typeof DuckFlowRuntimeController).toBe("function");
    });
  });

  describe("Functional integration", () => {
    it("should allow creating runtime using exported factory", async () => {
      const { createDuckFlowRuntime } = await import("../../../src/common/runtime");
      const runtime = createDuckFlowRuntime();

      expect(runtime).toBeDefined();
      expect(runtime.container).toBeDefined();
      expect(runtime.EntityManager).toBeDefined();

      runtime.dispose();
    });

    it("should allow accessing core modules through runtime", async () => {
      const { createDuckFlowRuntime } = await import("../../../src/common/runtime");
      const runtime = createDuckFlowRuntime();

      // Verify core modules are accessible
      expect(runtime.EntityManager).toBeDefined();
      expect(runtime.RenderManager).toBeDefined();
      expect(runtime.RegistryManager).toBeDefined();
      expect(runtime.EventBus).toBeDefined();

      runtime.dispose();
    });

    it("should allow using utility functions", async () => {
      const { hashString, clampPercentage } = await import("../../../src/common/runtime");

      const hash = hashString("test");
      expect(typeof hash).toBe("number");

      const clamped = clampPercentage(150);
      expect(clamped).toBe(100);
    });
  });
});
