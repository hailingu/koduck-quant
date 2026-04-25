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

  describe("构造函数和初始化", () => {
    it("应该成功创建实例", () => {
      expect(coordinator).toBeDefined();
      expect(coordinator).toBeInstanceOf(RuntimeManagerCoordinator);
    });

    it("应该正确设置核心 Manager 键", () => {
      const mockManager = createMockManager({ name: "entity" });

      // 尝试注册核心 Manager 应该被阻止
      coordinator.registerManager("entity", mockManager);

      // 不应该被添加到注册列表
      expect(coordinator.getRegisteredManagers()).not.toContain("entity");
    });
  });

  describe("registerManager() - 注册 Manager", () => {
    it("应该成功注册一个 Manager", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);

      expect(coordinator.hasManager("spatial")).toBe(true);
      expect(coordinator.getRegisteredManagers()).toContain("spatial");
    });

    it("应该阻止重复注册", () => {
      const manager1 = createMockManager({ name: "spatial" });
      const manager2 = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager1);
      coordinator.registerManager("spatial", manager2);

      const managers = coordinator.getRegisteredManagers();
      expect(managers.filter((name) => name === "spatial")).toHaveLength(1);
    });

    it("应该记录依赖关系", () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, {
        dependencies: ["entity", "render"],
      });

      expect(coordinator.hasManager("spatial")).toBe(true);
    });

    it("应该在非懒加载时自动初始化", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, {
        lazy: false,
      });

      // 等待异步初始化
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(manager.initialize).toHaveBeenCalled();
    });

    it("应该在懒加载时不自动初始化", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, {
        lazy: true,
      });

      // 等待一段时间
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(manager.initialize).not.toHaveBeenCalled();
    });
  });

  describe("unregisterManager() - 卸载 Manager", () => {
    it("应该成功卸载 Manager", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);
      expect(coordinator.hasManager("spatial")).toBe(true);

      coordinator.unregisterManager("spatial");
      expect(coordinator.hasManager("spatial")).toBe(false);
    });

    it("应该调用 Manager 的 dispose 方法", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);
      coordinator.unregisterManager("spatial");

      expect(manager.dispose).toHaveBeenCalled();
    });

    it("应该阻止卸载核心 Manager", () => {
      coordinator.unregisterManager("entity");
      // 不应该抛出错误，只是被阻止
      expect(coordinator.hasManager("entity")).toBe(false);
      expect(coordinator.getRegisteredManagers()).not.toContain("entity");
    });
  });

  describe("getManager() - 获取 Manager", () => {
    it("应该返回已注册的 Manager", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);

      const retrieved = coordinator.getManager("spatial");
      expect(retrieved).toBe(manager);
    });

    it("应该在 Manager 不存在时返回 undefined", () => {
      const manager = coordinator.getManager("nonexistent");
      expect(manager).toBeUndefined();
    });

    it("应该在访问时触发懒加载初始化", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, { lazy: true });

      coordinator.getManager("spatial");

      // 等待异步初始化
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(manager.initialize).toHaveBeenCalled();
    });
  });

  describe("initializeManager() - 初始化 Manager", () => {
    it("应该成功初始化 Manager", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, { lazy: true });

      await coordinator.initializeManager("spatial");

      expect(manager.initialize).toHaveBeenCalled();
      expect(coordinator.getInitializedManagers()).toContain("spatial");
    });

    it("应该在 Manager 不存在时抛出错误", async () => {
      await expect(coordinator.initializeManager("nonexistent")).rejects.toThrow();
    });

    it("应该在初始化失败时抛出错误", async () => {
      const manager = createMockManager({
        name: "spatial",
        shouldInitialize: true,
        shouldFail: true,
      });

      coordinator.registerManager("spatial", manager, { lazy: true });

      await expect(coordinator.initializeManager("spatial")).rejects.toThrow();
    });

    it("应该支持重试机制", async () => {
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

    it("应该在没有 initialize 方法时成功完成", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: false });

      coordinator.registerManager("spatial", manager, { lazy: true });

      await coordinator.initializeManager("spatial");

      expect(coordinator.getInitializedManagers()).toContain("spatial");
    });

    it("应该避免重复初始化", async () => {
      const manager = createMockManager({ name: "spatial", shouldInitialize: true });

      coordinator.registerManager("spatial", manager, { lazy: true });

      await coordinator.initializeManager("spatial");
      await coordinator.initializeManager("spatial");

      expect(manager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe("依赖解析", () => {
    it("应该在初始化前解析单个依赖", async () => {
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

    it("应该在初始化前解析多个依赖", async () => {
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

    it("应该检测并阻止循环依赖", async () => {
      const a = createMockManager({ name: "a", shouldInitialize: true });
      const b = createMockManager({ name: "b", shouldInitialize: true });

      coordinator.registerManager("a", a, { dependencies: ["b"], lazy: true });
      coordinator.registerManager("b", b, { dependencies: ["a"], lazy: true });

      try {
        await coordinator.initializeManager("a");
        expect.fail("Expected circular dependency error");
      } catch (error) {
        // 循环依赖错误应该在 cause 中
        expect(error).toBeInstanceOf(Error);
        const err = error as Error & { cause?: Error };
        expect(err.message).toContain("dependency 'b' failed to initialize");
        expect(err.cause).toBeDefined();
        expect(err.cause?.message).toMatch(/circular dependency/i);
      }
    });

    it("应该在依赖缺失时抛出错误", async () => {
      const target = createMockManager({ name: "target", shouldInitialize: true });

      coordinator.registerManager("target", target, {
        dependencies: ["missing"],
        lazy: true,
      });

      await expect(coordinator.initializeManager("target")).rejects.toThrow(/missing dependency/i);
    });
  });

  describe("dispose() - 释放资源", () => {
    it("应该释放所有已注册的 Manager", () => {
      const manager1 = createMockManager({ name: "m1" });
      const manager2 = createMockManager({ name: "m2" });

      coordinator.registerManager("m1", manager1);
      coordinator.registerManager("m2", manager2);

      coordinator.dispose();

      expect(manager1.dispose).toHaveBeenCalled();
      expect(manager2.dispose).toHaveBeenCalled();
    });

    it("应该清空所有内部映射表", () => {
      const manager = createMockManager({ name: "spatial" });

      coordinator.registerManager("spatial", manager);
      coordinator.dispose();

      expect(coordinator.getRegisteredManagers()).toHaveLength(0);
      expect(coordinator.getInitializedManagers()).toHaveLength(0);
    });
  });

  describe("getManagerInitializationDefaults()", () => {
    it("应该返回默认初始化配置", () => {
      const defaults = coordinator.getManagerInitializationDefaults();

      expect(defaults).toHaveProperty("retries");
      expect(defaults.retries).toHaveProperty("attempts");
      expect(defaults.retries).toHaveProperty("delayMs");
      expect(defaults).toHaveProperty("warnOnRetry");
    });
  });
});
