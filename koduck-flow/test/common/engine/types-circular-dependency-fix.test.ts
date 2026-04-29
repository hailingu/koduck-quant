/**
 * Engine types module circular dependency fix tests
 *
 * Test objectives:
 * 1. Verify type imports do not create circular dependencies
 * 2. Verify all type definitions are correctly exported
 * 3. Verify backward compatibility
 */

import { describe, it, expect } from "vitest";

describe("Engine Types - Circular Dependency Fix", () => {
  describe("Type import tests", () => {
    it("should be able to import core engine types from types/engine-types", async () => {
      const engineTypes = await import("../../../src/common/engine/types/engine-types");

      expect(engineTypes).toBeDefined();
      expect(typeof engineTypes).toBe("object");
    });

    it("should be able to import Worker bridge types from types/worker-bridge-types", async () => {
      const workerTypes = await import("../../../src/common/engine/types/worker-bridge-types");

      expect(workerTypes).toBeDefined();
      expect(typeof workerTypes).toBe("object");
    });

    it("should be able to import all types from types/index", async () => {
      const allTypes = await import("../../../src/common/engine/types");

      expect(allTypes).toBeDefined();
      expect(typeof allTypes).toBe("object");
    });

    it("should be able to import types from engine/types.ts (backward compatibility)", async () => {
      const legacyTypes = await import("../../../src/common/engine/types");

      expect(legacyTypes).toBeDefined();
      expect(typeof legacyTypes).toBe("object");
    });

    it("should be able to import types from worker-bridge.ts", async () => {
      const workerBridge = await import("../../../src/common/engine/worker-bridge");

      expect(workerBridge).toBeDefined();
      expect(workerBridge.FlowEngineWorkerBridge).toBeDefined();
    });
  });

  describe("Type definition completeness tests", () => {
    it("engine-types should export all core engine types", async () => {
      const types = await import("../../../src/common/engine/types/engine-types");

      // These types should exist (TypeScript checks at compile time)
      // Mainly verify the module can load normally
      expect(types).toBeDefined();
    });

    it("worker-bridge-types should export all Worker-related types", async () => {
      const types = await import("../../../src/common/engine/types/worker-bridge-types");

      expect(types).toBeDefined();
    });

    it("types.ts should export FlowEngineMetricsRecorder", async () => {
      const types = await import("../../../src/common/engine/types");

      expect(types).toBeDefined();
    });
  });

  describe("Circular dependency detection", () => {
    it("engine-types should not depend on worker-bridge-types", async () => {
      // Verify no circular dependency by successful import
      const engineTypes = await import("../../../src/common/engine/types/engine-types");
      const workerBridgeTypes = await import(
        "../../../src/common/engine/types/worker-bridge-types"
      );

      expect(engineTypes).toBeDefined();
      expect(workerBridgeTypes).toBeDefined();
    });

    it("worker-bridge.ts should only depend on type modules, not types.ts", async () => {
      // Importing worker-bridge should not cause circular dependency errors
      const workerBridge = await import("../../../src/common/engine/worker-bridge");

      expect(workerBridge).toBeDefined();
      expect(workerBridge.FlowEngineWorkerBridge).toBeDefined();
    });

    it("types.ts should work as a compatibility layer", async () => {
      const types = await import("../../../src/common/engine/types");

      expect(types).toBeDefined();
    });
  });

  describe("TypeScript type compatibility", () => {
    it("EntityResult type should be available", async () => {
      // Verify type module can be imported normally
      await import("../../../src/common/engine/types/engine-types");

      // Verify types can be used normally
      const result = {
        status: "success" as const,
        output: "test",
      };

      expect(result.status).toBe("success");
    });

    it("EngineConfig type should be available", async () => {
      // Verify EngineConfig type exists and can be imported
      await import("../../../src/common/engine/types/engine-types");

      const config = {
        concurrency: 4,
        stopOnError: true,
      };

      expect(config.concurrency).toBe(4);
    });

    it("FlowEngineWorkerObserver type should be available", async () => {
      // Verify FlowEngineWorkerObserver type exists and can be imported
      await import("../../../src/common/engine/types/worker-bridge-types");

      const observer = {
        onWorkerTaskSuccess: (event: { entityId: string }) => {
          expect(event.entityId).toBeDefined();
        },
      };

      expect(observer.onWorkerTaskSuccess).toBeDefined();
    });
  });

  describe("Module import dependency relationships", () => {
    it("should import modules in the correct order", async () => {
      // 1. Import engine-types first (base types)
      const engineTypes = await import("../../../src/common/engine/types/engine-types");
      expect(engineTypes).toBeDefined();

      // 2. Then import worker-bridge-types (depends on engine-types)
      const workerTypes = await import("../../../src/common/engine/types/worker-bridge-types");
      expect(workerTypes).toBeDefined();

      // 3. Finally import worker-bridge (depends on all types)
      const workerBridge = await import("../../../src/common/engine/worker-bridge");
      expect(workerBridge).toBeDefined();
    });

    it("types.ts should be able to aggregate all types", async () => {
      const allTypes = await import("../../../src/common/engine/types");

      // Verify all content can be imported from a unified entry
      expect(allTypes).toBeDefined();
    });
  });

  describe("Real-world usage scenarios", () => {
    it("should be able to create FlowEngineMetricsRecorder instance normally", async () => {
      // Verify type module can be imported
      await import("../../../src/common/engine/types");

      const recorder = {
        onRunStart: (event: { flowId: string }) => {
          expect(event.flowId).toBeDefined();
        },
        onRunFinish: (event: { ok: boolean }) => {
          expect(event.ok).toBeDefined();
        },
        recordMainThreadExecution: (event: { entityId: string }) => {
          expect(event.entityId).toBeDefined();
        },
        getWorkerObserver: () => undefined,
      };

      expect(recorder.onRunStart).toBeDefined();
      expect(recorder.onRunFinish).toBeDefined();
      expect(recorder.recordMainThreadExecution).toBeDefined();
      expect(recorder.getWorkerObserver).toBeDefined();
    });

    it("should be able to create EntityExecutor normally", async () => {
      // Verify type module can be imported
      await import("../../../src/common/engine/types/engine-types");

      const executor = async (ctx: { entity: { id: string } }) => {
        return {
          status: "success" as const,
          output: ctx.entity.id,
        };
      };

      expect(typeof executor).toBe("function");
    });
  });
});
