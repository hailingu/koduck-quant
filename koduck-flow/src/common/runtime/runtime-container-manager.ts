/**
 * @module src/common/runtime/runtime-container-manager
 * @description Manages KoduckFlow runtime DI container lifecycle and core service access.
 * Handles service resolution, core service getters, and container cleanup.
 * Provides centralized access to EntityManager, RenderManager, RegistryManager, and event systems.
 * @example
 * ```typescript
 * const manager = new RuntimeContainerManager(container);
 * const entityMgr = manager.getEntityManager();
 * const registryMgr = manager.getRegistryManager();
 * ```
 */

/**
 * RuntimeContainerManager - DI 容器管理器
 *
 * @description
 * 负责管理 DI 容器的生命周期和核心服务访问。
 * 提供服务解析、核心服务 getter 和容器清理功能。
 *
 * @responsibilities
 * - 管理 DI 容器引用
 * - 提供服务注册与解析
 * - 管理核心服务（Entity/Render/Registry/Event）访问
 * - 处理容器清理和资源释放
 *
 * @module runtime/runtime-container-manager
 */

import type { IDisposable } from "../disposable";
import type { IDependencyContainer } from "../di/types";
import { TOKENS } from "../di/tokens";
import type { EntityManager } from "../entity/entity-manager";
import type { RenderManager } from "../render/render-manager";
import type { RegistryManager } from "../registry/registry-manager";
import type { EventBus } from "../event/event-bus";
import type { RenderEventManager } from "../event/render-event-manager";
import type { EntityEventManager } from "../event/entity-event-manager";
import type { IEntity } from "../entity";

/**
 * 核心管理器集合接口
 *
 * @description
 * 包含所有核心服务管理器的引用
 */
export interface CoreManagers {
  /** 实体管理器 - 管理实体的创建、查询和生命周期 */
  entity: EntityManager;
  /** 渲染管理器 - 管理实体的渲染和视图更新 */
  render: RenderManager;
  /** 注册表管理器 - 管理实体类型注册和查找 */
  registry: RegistryManager;
  /** 事件总线 - 全局事件分发 */
  eventBus: EventBus;
  /** 渲染事件管理器 - 渲染相关事件管理 */
  renderEvents: RenderEventManager;
  /** 实体事件管理器 - 实体相关事件管理 */
  entityEvents: EntityEventManager<IEntity>;
}

/**
 * RuntimeContainerManager 类
 *
 * @description
 * DI 容器管理器，封装容器操作和核心服务访问。
 * 作为 KoduckFlowRuntime 的子模块，专注于容器管理职责。
 *
 * @example
 * ```typescript
 * const container = createCoreContainer();
 * const containerManager = new RuntimeContainerManager(container);
 *
 * // 服务解析
 * const service = containerManager.resolve<MyService>(TOKENS.myService);
 *
 * // 核心服务访问
 * const entityManager = containerManager.getEntityManager();
 *
 * // 清理
 * containerManager.dispose();
 * ```
 */
export class RuntimeContainerManager implements IDisposable {
  /** DI 容器实例（只读） */
  readonly container: IDependencyContainer;

  /** 核心管理器缓存 */
  private readonly coreManagers: CoreManagers;

  /** 标记是否已释放 */
  private disposed = false;

  /**
   * 构造函数
   *
   * @param container - DI 容器实例
   *
   * @throws {Error} 如果容器为 null 或 undefined
   *
   * @description
   * 初始化容器管理器并解析所有核心服务。
   * 核心服务在构造时立即解析并缓存，避免重复解析开销。
   */
  constructor(container: IDependencyContainer) {
    if (!container) {
      throw new Error("Container cannot be null or undefined");
    }

    this.container = container;

    // 解析并缓存所有核心服务
    this.coreManagers = {
      entity: container.resolve<EntityManager>(TOKENS.entityManager),
      render: container.resolve<RenderManager>(TOKENS.renderManager),
      registry: container.resolve<RegistryManager>(TOKENS.registryManager),
      eventBus: container.resolve<EventBus>(TOKENS.eventBus),
      renderEvents: container.resolve<RenderEventManager>(TOKENS.renderEventManager),
      entityEvents: container.resolve<EntityEventManager<IEntity>>(TOKENS.entityEventManager),
    };
  }

  /**
   * 从容器中解析服务
   *
   * @template T - 服务类型
   * @param token - 服务标识（字符串或 Symbol）
   * @returns 解析的服务实例
   *
   * @throws {Error} 如果容器已释放
   * @throws {Error} 如果服务未注册或解析失败
   *
   * @example
   * ```typescript
   * const myService = containerManager.resolve<MyService>(TOKENS.myService);
   * ```
   */
  resolve<T>(token: string | symbol): T {
    this.ensureNotDisposed();
    return this.container.resolve<T>(token);
  }

  /**
   * 检查容器中是否存在指定服务
   *
   * @param token - 服务标识（字符串或 Symbol）
   * @returns 如果服务已注册返回 true，否则返回 false
   *
   * @throws {Error} 如果容器已释放
   *
   * @example
   * ```typescript
   * if (containerManager.has(TOKENS.myService)) {
   *   const service = containerManager.resolve<MyService>(TOKENS.myService);
   * }
   * ```
   */
  has(token: string | symbol): boolean {
    this.ensureNotDisposed();
    return this.container.has(token);
  }

  /**
   * 获取所有核心管理器
   *
   * @returns 核心管理器集合
   *
   * @throws {Error} 如果容器已释放
   *
   * @description
   * 返回包含所有核心服务的对象。
   * 核心服务在构造时已解析并缓存，此方法直接返回缓存。
   */
  getCoreManagers(): CoreManagers {
    this.ensureNotDisposed();
    return this.coreManagers;
  }

  /**
   * 获取实体管理器
   *
   * @returns EntityManager 实例
   *
   * @throws {Error} 如果容器已释放
   *
   * @description
   * 便捷方法，直接访问实体管理器。
   */
  getEntityManager(): EntityManager {
    this.ensureNotDisposed();
    return this.coreManagers.entity;
  }

  /**
   * 获取渲染管理器
   *
   * @returns RenderManager 实例
   *
   * @throws {Error} 如果容器已释放
   *
   * @description
   * 便捷方法，直接访问渲染管理器。
   */
  getRenderManager(): RenderManager {
    this.ensureNotDisposed();
    return this.coreManagers.render;
  }

  /**
   * 获取注册表管理器
   *
   * @returns RegistryManager 实例
   *
   * @throws {Error} 如果容器已释放
   *
   * @description
   * 便捷方法，直接访问注册表管理器。
   */
  getRegistryManager(): RegistryManager {
    this.ensureNotDisposed();
    return this.coreManagers.registry;
  }

  /**
   * 获取事件总线
   *
   * @returns EventBus 实例
   *
   * @throws {Error} 如果容器已释放
   *
   * @description
   * 便捷方法，直接访问事件总线。
   */
  getEventBus(): EventBus {
    this.ensureNotDisposed();
    return this.coreManagers.eventBus;
  }

  /**
   * 获取渲染事件管理器
   *
   * @returns RenderEventManager 实例
   *
   * @throws {Error} 如果容器已释放
   *
   * @description
   * 便捷方法，直接访问渲染事件管理器。
   */
  getRenderEvents(): RenderEventManager {
    this.ensureNotDisposed();
    return this.coreManagers.renderEvents;
  }

  /**
   * 获取实体事件管理器
   *
   * @returns EntityEventManager 实例
   *
   * @throws {Error} 如果容器已释放
   *
   * @description
   * 便捷方法，直接访问实体事件管理器。
   */
  getEntityEvents(): EntityEventManager<IEntity> {
    this.ensureNotDisposed();
    return this.coreManagers.entityEvents;
  }

  /**
   * 获取 Worker Pool 管理器
   *
   * @returns WorkerPoolManager 实例 | undefined
   *
   * @throws {Error} 如果容器已释放
   *
   * @description
   * 便捷方法，直接访问 Worker Pool 管理器（如果已注册）。
   * 如果 Worker Pool 未在 DI 容器中注册，返回 undefined。
   */
  getWorkerPoolManager() {
    this.ensureNotDisposed();
    try {
      return this.container.resolve(TOKENS.workerPoolManager);
    } catch {
      return undefined;
    }
  }

  /**
   * 释放容器管理器资源
   *
   * @description
   * 清理核心管理器缓存，标记为已释放。
   * 注意：此方法不会释放容器本身，容器的生命周期由外部管理。
   *
   * @remarks
   * 多次调用 dispose() 是安全的，但只有第一次调用会执行清理。
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    // 清理缓存引用（帮助 GC）
    // 注意：不释放 container，因为它由 KoduckFlowRuntime 管理
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.coreManagers as any).entity = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.coreManagers as any).render = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.coreManagers as any).registry = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.coreManagers as any).eventBus = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.coreManagers as any).renderEvents = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.coreManagers as any).entityEvents = null;

    this.disposed = true;
  }

  /**
   * 检查是否已释放
   *
   * @throws {Error} 如果已释放
   *
   * @private
   * @description
   * 内部方法，用于在操作前检查状态。
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error("RuntimeContainerManager has been disposed");
    }
  }
}

/**
 * 注册 Runtime 实例到容器
 *
 * @param container - DI 容器实例
 * @param runtime - KoduckFlowRuntime 实例
 *
 * @description
 * 将 runtime 实例注册到容器中，供其他服务依赖注入使用。
 * 同时注册租户上下文、配额、Rollout 的占位符。
 *
 * @internal
 * @remarks
 * 此函数从 koduck-flow-runtime.ts 迁移而来，保持向后兼容。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerRuntimeInstance(container: IDependencyContainer, runtime: any): void {
  container.registerInstance(TOKENS.runtime, runtime, {
    lifecycle: "singleton",
    replace: true,
    ownsInstance: false,
  });

  // 注册租户相关占位符（初始值为 null）
  container.registerInstance(TOKENS.tenantContext, null, {
    lifecycle: "singleton",
    replace: true,
    ownsInstance: false,
  });

  container.registerInstance(TOKENS.tenantQuota, null, {
    lifecycle: "singleton",
    replace: true,
    ownsInstance: false,
  });

  container.registerInstance(TOKENS.tenantRollout, null, {
    lifecycle: "singleton",
    replace: true,
    ownsInstance: false,
  });
}
