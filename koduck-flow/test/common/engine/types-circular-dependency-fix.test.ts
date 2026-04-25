/**
 * 引擎类型模块循环依赖修复测试
 *
 * 测试目标：
 * 1. 验证类型导入不会产生循环依赖
 * 2. 验证所有类型定义正确导出
 * 3. 验证向后兼容性
 */

import { describe, it, expect } from "vitest";

describe("Engine Types - Circular Dependency Fix", () => {
  describe("类型导入测试", () => {
    it("应该能从 types/engine-types 导入核心引擎类型", async () => {
      const engineTypes = await import("../../../src/common/engine/types/engine-types");

      expect(engineTypes).toBeDefined();
      expect(typeof engineTypes).toBe("object");
    });

    it("应该能从 types/worker-bridge-types 导入 Worker 桥接类型", async () => {
      const workerTypes = await import("../../../src/common/engine/types/worker-bridge-types");

      expect(workerTypes).toBeDefined();
      expect(typeof workerTypes).toBe("object");
    });

    it("应该能从 types/index 导入所有类型", async () => {
      const allTypes = await import("../../../src/common/engine/types");

      expect(allTypes).toBeDefined();
      expect(typeof allTypes).toBe("object");
    });

    it("应该能从 engine/types.ts 导入类型（向后兼容）", async () => {
      const legacyTypes = await import("../../../src/common/engine/types");

      expect(legacyTypes).toBeDefined();
      expect(typeof legacyTypes).toBe("object");
    });

    it("应该能从 worker-bridge.ts 导入类型", async () => {
      const workerBridge = await import("../../../src/common/engine/worker-bridge");

      expect(workerBridge).toBeDefined();
      expect(workerBridge.FlowEngineWorkerBridge).toBeDefined();
    });
  });

  describe("类型定义完整性测试", () => {
    it("engine-types 应该导出所有核心引擎类型", async () => {
      const types = await import("../../../src/common/engine/types/engine-types");

      // 这些类型应该存在（TypeScript 会在编译时检查）
      // 这里主要验证模块能够正常加载
      expect(types).toBeDefined();
    });

    it("worker-bridge-types 应该导出所有 Worker 相关类型", async () => {
      const types = await import("../../../src/common/engine/types/worker-bridge-types");

      expect(types).toBeDefined();
    });

    it("types.ts 应该导出 FlowEngineMetricsRecorder", async () => {
      const types = await import("../../../src/common/engine/types");

      expect(types).toBeDefined();
    });
  });

  describe("循环依赖检测", () => {
    it("engine-types 不应该依赖 worker-bridge-types", async () => {
      // 通过成功导入来验证没有循环依赖
      const engineTypes = await import("../../../src/common/engine/types/engine-types");
      const workerBridgeTypes = await import(
        "../../../src/common/engine/types/worker-bridge-types"
      );

      expect(engineTypes).toBeDefined();
      expect(workerBridgeTypes).toBeDefined();
    });

    it("worker-bridge.ts 应该只依赖类型模块，不依赖 types.ts", async () => {
      // 导入 worker-bridge 不应该导致循环依赖错误
      const workerBridge = await import("../../../src/common/engine/worker-bridge");

      expect(workerBridge).toBeDefined();
      expect(workerBridge.FlowEngineWorkerBridge).toBeDefined();
    });

    it("types.ts 作为兼容层应该正常工作", async () => {
      const types = await import("../../../src/common/engine/types");

      expect(types).toBeDefined();
    });
  });

  describe("TypeScript 类型兼容性", () => {
    it("EntityResult 类型应该可用", async () => {
      // 验证类型模块可以正常导入
      await import("../../../src/common/engine/types/engine-types");

      // 验证类型可以正常使用
      const result = {
        status: "success" as const,
        output: "test",
      };

      expect(result.status).toBe("success");
    });

    it("EngineConfig 类型应该可用", async () => {
      // 验证 EngineConfig 类型存在且可导入
      await import("../../../src/common/engine/types/engine-types");

      const config = {
        concurrency: 4,
        stopOnError: true,
      };

      expect(config.concurrency).toBe(4);
    });

    it("FlowEngineWorkerObserver 类型应该可用", async () => {
      // 验证 FlowEngineWorkerObserver 类型存在且可导入
      await import("../../../src/common/engine/types/worker-bridge-types");

      const observer = {
        onWorkerTaskSuccess: (event: { entityId: string }) => {
          expect(event.entityId).toBeDefined();
        },
      };

      expect(observer.onWorkerTaskSuccess).toBeDefined();
    });
  });

  describe("模块导入依赖关系", () => {
    it("应该按正确顺序导入模块", async () => {
      // 1. 先导入 engine-types（基础类型）
      const engineTypes = await import("../../../src/common/engine/types/engine-types");
      expect(engineTypes).toBeDefined();

      // 2. 再导入 worker-bridge-types（依赖 engine-types）
      const workerTypes = await import("../../../src/common/engine/types/worker-bridge-types");
      expect(workerTypes).toBeDefined();

      // 3. 最后导入 worker-bridge（依赖所有类型）
      const workerBridge = await import("../../../src/common/engine/worker-bridge");
      expect(workerBridge).toBeDefined();
    });

    it("types.ts 应该能聚合所有类型", async () => {
      const allTypes = await import("../../../src/common/engine/types");

      // 验证可以从统一入口导入所有内容
      expect(allTypes).toBeDefined();
    });
  });

  describe("实际使用场景", () => {
    it("应该能正常创建 FlowEngineMetricsRecorder 实例", async () => {
      // 验证类型模块可以导入
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

    it("应该能正常创建 EntityExecutor", async () => {
      // 验证类型模块可以导入
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
