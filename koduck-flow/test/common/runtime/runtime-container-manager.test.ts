/**
 * RuntimeContainerManager 单元测试
 *
 * @description
 * 测试容器管理器的所有功能，确保服务解析、核心服务访问和生命周期管理正常工作。
 *
 * @coverage
 * - 构造函数和初始化
 * - 服务解析 (resolve, has)
 * - 核心服务访问 (getCoreManagers, get*Manager)
 * - 生命周期管理 (dispose)
 * - 错误处理
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

  describe("构造函数和初始化", () => {
    it("应该成功创建实例", () => {
      expect(containerManager).toBeDefined();
      expect(containerManager.container).toBe(container);
    });

    it("应该在构造时解析并缓存所有核心服务", () => {
      const coreManagers = containerManager.getCoreManagers();

      expect(coreManagers.entity).toBeDefined();
      expect(coreManagers.render).toBeDefined();
      expect(coreManagers.registry).toBeDefined();
      expect(coreManagers.eventBus).toBeDefined();
      expect(coreManagers.renderEvents).toBeDefined();
      expect(coreManagers.entityEvents).toBeDefined();
    });

    it("应该在容器为 null 时抛出错误", () => {
      expect(() => new RuntimeContainerManager(null as unknown as IDependencyContainer)).toThrow(
        "Container cannot be null or undefined"
      );
    });

    it("应该在容器为 undefined 时抛出错误", () => {
      expect(
        () => new RuntimeContainerManager(undefined as unknown as IDependencyContainer)
      ).toThrow("Container cannot be null or undefined");
    });
  });

  describe("resolve() - 服务解析", () => {
    it("应该成功解析已注册的服务", () => {
      const entityManager = containerManager.resolve(TOKENS.entityManager);
      expect(entityManager).toBeDefined();
    });

    it("应该能解析核心服务", () => {
      const renderManager = containerManager.resolve(TOKENS.renderManager);
      const registryManager = containerManager.resolve(TOKENS.registryManager);
      const eventBus = containerManager.resolve(TOKENS.eventBus);

      expect(renderManager).toBeDefined();
      expect(registryManager).toBeDefined();
      expect(eventBus).toBeDefined();
    });

    it("resolve() 应该在容器已释放时抛出错误", () => {
      containerManager.dispose();
      const fn = () => containerManager.resolve(TOKENS.entityManager);
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });

    it("resolve() 应该在服务未注册时抛出错误", () => {
      const fn = () => containerManager.resolve("non-existent-service");
      expect(fn).toThrow();
    });
  });

  describe("has() - 服务检查", () => {
    it("应该对已注册的服务返回 true", () => {
      expect(containerManager.has(TOKENS.entityManager)).toBe(true);
      expect(containerManager.has(TOKENS.renderManager)).toBe(true);
      expect(containerManager.has(TOKENS.registryManager)).toBe(true);
    });

    it("应该对未注册的服务返回 false", () => {
      expect(containerManager.has("non-existent-service")).toBe(false);
    });

    it("has() 应该在容器已释放时抛出错误", () => {
      containerManager.dispose();
      const fn = () => containerManager.has(TOKENS.entityManager);
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getCoreManagers() - 批量访问核心服务", () => {
    it("应该返回所有核心管理器", () => {
      const coreManagers = containerManager.getCoreManagers();

      expect(coreManagers).toBeDefined();
      expect(coreManagers.entity).toBeDefined();
      expect(coreManagers.render).toBeDefined();
      expect(coreManagers.registry).toBeDefined();
      expect(coreManagers.eventBus).toBeDefined();
      expect(coreManagers.renderEvents).toBeDefined();
      expect(coreManagers.entityEvents).toBeDefined();
    });

    it("应该返回缓存的实例", () => {
      const coreManagers1 = containerManager.getCoreManagers();
      const coreManagers2 = containerManager.getCoreManagers();

      expect(coreManagers1).toBe(coreManagers2);
      expect(coreManagers1.entity).toBe(coreManagers2.entity);
    });

    it("getCoreManagers() 应该在容器已释放时抛出错误", () => {
      containerManager.dispose();
      const fn = () => containerManager.getCoreManagers();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getEntityManager() - 单一服务访问", () => {
    it("应该返回实体管理器", () => {
      const entityManager = containerManager.getEntityManager();
      expect(entityManager).toBeDefined();
    });

    it("应该返回与 getCoreManagers() 相同的实例", () => {
      const entityManager = containerManager.getEntityManager();
      const coreManagers = containerManager.getCoreManagers();
      expect(entityManager).toBe(coreManagers.entity);
    });

    it("getEntityManager() 应该在容器已释放时抛出错误", () => {
      containerManager.dispose();
      const fn = () => containerManager.getEntityManager();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getRenderManager() - 单一服务访问", () => {
    it("应该返回渲染管理器", () => {
      const renderManager = containerManager.getRenderManager();
      expect(renderManager).toBeDefined();
    });

    it("应该返回与 getCoreManagers() 相同的实例", () => {
      const renderManager = containerManager.getRenderManager();
      const coreManagers = containerManager.getCoreManagers();
      expect(renderManager).toBe(coreManagers.render);
    });

    it("getRenderManager() 应该在容器已释放时抛出错误", () => {
      containerManager.dispose();
      const fn = () => containerManager.getRenderManager();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getRegistryManager() - 单一服务访问", () => {
    it("应该返回注册表管理器", () => {
      const registryManager = containerManager.getRegistryManager();
      expect(registryManager).toBeDefined();
    });

    it("应该返回与 getCoreManagers() 相同的实例", () => {
      const registryManager = containerManager.getRegistryManager();
      const coreManagers = containerManager.getCoreManagers();
      expect(registryManager).toBe(coreManagers.registry);
    });

    it("getRegistryManager() 应该在容器已释放时抛出错误", () => {
      containerManager.dispose();
      const fn = () => containerManager.getRegistryManager();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getEventBus() - 单一服务访问", () => {
    it("应该返回事件总线", () => {
      const eventBus = containerManager.getEventBus();
      expect(eventBus).toBeDefined();
    });

    it("应该返回与 getCoreManagers() 相同的实例", () => {
      const eventBus = containerManager.getEventBus();
      const coreManagers = containerManager.getCoreManagers();
      expect(eventBus).toBe(coreManagers.eventBus);
    });

    it("getEventBus() 应该在容器已释放时抛出错误", () => {
      containerManager.dispose();
      const fn = () => containerManager.getEventBus();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getRenderEvents() - 单一服务访问", () => {
    it("应该返回渲染事件管理器", () => {
      const renderEvents = containerManager.getRenderEvents();
      expect(renderEvents).toBeDefined();
    });

    it("应该返回与 getCoreManagers() 相同的实例", () => {
      const renderEvents = containerManager.getRenderEvents();
      const coreManagers = containerManager.getCoreManagers();
      expect(renderEvents).toBe(coreManagers.renderEvents);
    });

    it("getRenderEvents() 应该在容器已释放时抛出错误", () => {
      containerManager.dispose();
      const fn = () => containerManager.getRenderEvents();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("getEntityEvents() - 单一服务访问", () => {
    it("应该返回实体事件管理器", () => {
      const entityEvents = containerManager.getEntityEvents();
      expect(entityEvents).toBeDefined();
    });

    it("应该返回与 getCoreManagers() 相同的实例", () => {
      const entityEvents = containerManager.getEntityEvents();
      const coreManagers = containerManager.getCoreManagers();
      expect(entityEvents).toBe(coreManagers.entityEvents);
    });

    it("getEntityEvents() 应该在容器已释放时抛出错误", () => {
      containerManager.dispose();
      const fn = () => containerManager.getEntityEvents();
      expect(fn).toThrow("RuntimeContainerManager has been disposed");
    });
  });

  describe("dispose() - 生命周期管理", () => {
    it("应该成功释放资源", () => {
      const fn = () => containerManager.dispose();
      expect(fn).not.toThrow();
    });

    it("应该清理核心管理器缓存", () => {
      const coreManagers = containerManager.getCoreManagers();
      containerManager.dispose();

      // 缓存应该被清空（设置为 null）
      expect(coreManagers.entity).toBeNull();
      expect(coreManagers.render).toBeNull();
      expect(coreManagers.registry).toBeNull();
      expect(coreManagers.eventBus).toBeNull();
      expect(coreManagers.renderEvents).toBeNull();
      expect(coreManagers.entityEvents).toBeNull();
    });

    it("应该多次调用 dispose() 不抛出错误", () => {
      containerManager.dispose();
      const fn1 = () => containerManager.dispose();
      const fn2 = () => containerManager.dispose();
      expect(fn1).not.toThrow();
      expect(fn2).not.toThrow();
    });

    it("应该在释放后禁止所有操作", () => {
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

  it("应该成功注册 runtime 实例", () => {
    registerRuntimeInstance(container, mockRuntime);

    const registeredRuntime = container.resolve(TOKENS.runtime);
    expect(registeredRuntime).toBe(mockRuntime);
  });

  it("应该注册租户上下文占位符", () => {
    registerRuntimeInstance(container, mockRuntime);

    expect(container.has(TOKENS.tenantContext)).toBe(true);
    expect(container.resolve(TOKENS.tenantContext)).toBeNull();
  });

  it("应该注册租户配额占位符", () => {
    registerRuntimeInstance(container, mockRuntime);

    expect(container.has(TOKENS.tenantQuota)).toBe(true);
    expect(container.resolve(TOKENS.tenantQuota)).toBeNull();
  });

  it("应该注册租户 Rollout 占位符", () => {
    registerRuntimeInstance(container, mockRuntime);

    expect(container.has(TOKENS.tenantRollout)).toBe(true);
    expect(container.resolve(TOKENS.tenantRollout)).toBeNull();
  });

  it("应该允许替换现有的 runtime 实例", () => {
    const runtime1 = { id: "runtime-1" };
    const runtime2 = { id: "runtime-2" };

    registerRuntimeInstance(container, runtime1);
    registerRuntimeInstance(container, runtime2);

    const registeredRuntime = container.resolve(TOKENS.runtime);
    expect(registeredRuntime).toBe(runtime2);
  });
});
