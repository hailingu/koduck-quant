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
 * RuntimeContainerManager - DI container manager
 *
 * @description
 * Responsible for managing the DI container lifecycle and core service access.
 * Provides service resolution, core service getters, and container cleanup.
 *
 * @responsibilities
 * - Manage DI container reference
 * - Provide service registration and resolution
 * - Manage core service (Entity/Render/Registry/Event) access
 * - Handle container cleanup and resource release
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
 * Core manager collection interface
 *
 * @description
 * Contains references to all core service managers
 */
export interface CoreManagers {
  /** Entity manager - manages entity creation, querying, and lifecycle */
  entity: EntityManager;
  /** Render manager - manages entity rendering and view updates */
  render: RenderManager;
  /** Registry manager - manages entity type registration and lookup */
  registry: RegistryManager;
  /** Event bus - global event dispatch */
  eventBus: EventBus;
  /** Render event manager - rendering-related event management */
  renderEvents: RenderEventManager;
  /** Entity event manager - entity-related event management */
  entityEvents: EntityEventManager<IEntity>;
}

/**
 * RuntimeContainerManager class
 *
 * @description
 * DI container manager that encapsulates container operations and core service access.
 * As a submodule of KoduckFlowRuntime, focuses on container management responsibilities.
 *
 * @example
 * ```typescript
 * const container = createCoreContainer();
 * const containerManager = new RuntimeContainerManager(container);
 *
 * // Service resolution
 * const service = containerManager.resolve<MyService>(TOKENS.myService);
 *
 * // Core service access
 * const entityManager = containerManager.getEntityManager();
 *
 * // Cleanup
 * containerManager.dispose();
 * ```
 */
export class RuntimeContainerManager implements IDisposable {
  /** DI container instance (read-only) */
  readonly container: IDependencyContainer;

  /** Core manager cache */
  private readonly coreManagers: CoreManagers;

  /** Flag indicating whether disposed */
  private disposed = false;

  /**
   * Constructor
   *
   * @param container - DI container instance
   *
   * @throws {Error} If container is null or undefined
   *
   * @description
   * Initializes the container manager and resolves all core services.
   * Core services are resolved and cached immediately at construction to avoid repeated resolution overhead.
   */
  constructor(container: IDependencyContainer) {
    if (!container) {
      throw new Error("Container cannot be null or undefined");
    }

    this.container = container;

    // Resolve and cache all core services
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
   * Resolve service from container
   *
   * @template T - Service type
   * @param token - Service identifier (string or Symbol)
   * @returns Resolved service instance
   *
   * @throws {Error} If container has been disposed
   * @throws {Error} If service is not registered or resolution fails
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
   * Check if specified service exists in container
   *
   * @param token - Service identifier (string or Symbol)
   * @returns true if service is registered, false otherwise
   *
   * @throws {Error} If container has been disposed
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
   * Get all core managers
   *
   * @returns Core manager collection
   *
   * @throws {Error} If container has been disposed
   *
   * @description
   * Returns an object containing all core services.
   * Core services are resolved and cached at construction; this method returns the cache directly.
   */
  getCoreManagers(): CoreManagers {
    this.ensureNotDisposed();
    return this.coreManagers;
  }

  /**
   * Get entity manager
   *
   * @returns EntityManager instance
   *
   * @throws {Error} If container has been disposed
   *
   * @description
   * Convenience method to directly access the entity manager.
   */
  getEntityManager(): EntityManager {
    this.ensureNotDisposed();
    return this.coreManagers.entity;
  }

  /**
   * Get render manager
   *
   * @returns RenderManager instance
   *
   * @throws {Error} If container has been disposed
   *
   * @description
   * Convenience method to directly access the render manager.
   */
  getRenderManager(): RenderManager {
    this.ensureNotDisposed();
    return this.coreManagers.render;
  }

  /**
   * Get registry manager
   *
   * @returns RegistryManager instance
   *
   * @throws {Error} If container has been disposed
   *
   * @description
   * Convenience method to directly access the registry manager.
   */
  getRegistryManager(): RegistryManager {
    this.ensureNotDisposed();
    return this.coreManagers.registry;
  }

  /**
   * Get event bus
   *
   * @returns EventBus instance
   *
   * @throws {Error} If container has been disposed
   *
   * @description
   * Convenience method to directly access the event bus.
   */
  getEventBus(): EventBus {
    this.ensureNotDisposed();
    return this.coreManagers.eventBus;
  }

  /**
   * Get render event manager
   *
   * @returns RenderEventManager instance
   *
   * @throws {Error} If container has been disposed
   *
   * @description
   * Convenience method to directly access the render event manager.
   */
  getRenderEvents(): RenderEventManager {
    this.ensureNotDisposed();
    return this.coreManagers.renderEvents;
  }

  /**
   * Get entity event manager
   *
   * @returns EntityEventManager instance
   *
   * @throws {Error} If container has been disposed
   *
   * @description
   * Convenience method to directly access the entity event manager.
   */
  getEntityEvents(): EntityEventManager<IEntity> {
    this.ensureNotDisposed();
    return this.coreManagers.entityEvents;
  }

  /**
   * Get Worker Pool manager
   *
   * @returns WorkerPoolManager instance | undefined
   *
   * @throws {Error} If container has been disposed
   *
   * @description
   * Convenience method to directly access the Worker Pool manager (if registered).
   * Returns undefined if Worker Pool is not registered in the DI container.
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
   * Dispose container manager resources
   *
   * @description
   * Clean up core manager cache and mark as disposed.
   * Note: This method does not dispose the container itself; the container lifecycle is managed externally.
   *
   * @remarks
   * Multiple dispose() calls are safe, but only the first call performs cleanup.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    // Clean up cache references (help GC)
    // Note: Do not dispose container, as it is managed by KoduckFlowRuntime
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
   * Check if disposed
   *
   * @throws {Error} If already disposed
   *
   * @private
   * @description
   * Internal method used to check state before operations.
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error("RuntimeContainerManager has been disposed");
    }
  }
}

/**
 * Register Runtime instance to container
 *
 * @param container - DI container instance
 * @param runtime - KoduckFlowRuntime instance
 *
 * @description
 * Register the runtime instance into the container for use by other services via dependency injection.
 * Also registers placeholders for tenant context, quota, and rollout.
 *
 * @internal
 * @remarks
 * This function was migrated from koduck-flow-runtime.ts for backward compatibility.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerRuntimeInstance(container: IDependencyContainer, runtime: any): void {
  container.registerInstance(TOKENS.runtime, runtime, {
    lifecycle: "singleton",
    replace: true,
    ownsInstance: false,
  });

  // Register tenant-related placeholders (initial value is null)
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
