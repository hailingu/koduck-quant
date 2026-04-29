import type React from "react";

import type { IDisposable } from "../disposable";
import type { EventBus } from "../event/event-bus";
import type { EntityEventManager } from "../event/entity-event-manager";
import type { RenderEventManager } from "../event/render-event-manager";
import {
  createCoreContainer,
  registerCoreServices,
  type CoreServiceOverrides,
} from "../di/bootstrap";
import { RuntimeContainerManager, registerRuntimeInstance } from "./runtime-container-manager";
import { RuntimeTenantContext } from "./runtime-tenant-context";
import { RuntimeQuotaManager } from "./runtime-quota-manager";
import { RuntimeFeatureFlag } from "./runtime-feature-flag";
import { RuntimeDebugConfiguration } from "./runtime-debug-configuration";
import { RuntimeManagerCoordinator } from "./runtime-manager-coordinator";
import { RuntimeEntityOperations } from "./runtime-entity-operations";
import type { IDependencyContainer } from "../di/types";
import type { IEntity, IEntityArguments } from "../entity/";
import type { EntityManager } from "../entity/entity-manager";
import type { IManager } from "../manager/types";
import type { RenderManager } from "../render/render-manager";
import type { RegistryManager } from "../registry/registry-manager";
import type { DebugOptions } from "./debug-options";
import type { ResolvedTenantContext, TenantQuotaSnapshot } from "./tenant-context";
import type {
  ManagerInitializationOptions,
  ManagerRegistrationOptions,
  CoreManagerKey,
  KoduckFlowRuntimeOptions,
} from "./types";
import { CORE_MANAGER_KEYS, ManagerInitializationError } from "./types";

/**
 * @module src/common/runtime/koduck-flow-runtime
 * @description Main KoduckFlow runtime implementation orchestrating all runtime services.
 * Implements Facade Pattern with delegation to specialized managers for DI, tenant context,
 * quota management, and entity operations. Provides unified API for flow execution and resource management.
 * @example
 * ```typescript
 * const runtime = createKoduckFlowRuntime({
 *   environment: 'production',
 *   enableMetrics: true,
 *   enableCache: true
 * });
 * const result = await runtime.execute(flow, context);
 * runtime.dispose();
 * ```
 */

// Re-export types for backward compatibility
export type {
  ManagerInitializationOptions,
  ManagerRegistrationOptions,
  CoreManagerKey,
  KoduckFlowRuntimeOptions,
} from "./types";

/**
 * KoduckFlowRuntime - Main runtime orchestrator
 *
 * Responsibility: Acts as a facade-pattern orchestrator, delegating all operations to specialized modules.
 *
 * ## Architecture Patterns
 *
 * Adopts **Facade Pattern** + **Delegation Pattern**:
 * - Provides a unified, concise API externally
 * - Internally delegates to 7 specialized modules for specific logic
 * - Maintains 100% backward compatibility
 *
 * ## Module Composition (7 Core Modules)
 *
 * 1. **RuntimeContainerManager** - DI container management
 * 2. **RuntimeManagerCoordinator** - Manager lifecycle management
 * 3. **RuntimeTenantContext** - Tenant context management
 * 4. **RuntimeQuotaManager** - Quota management and enforcement
 * 5. **RuntimeFeatureFlag** - Feature flags and gradual rollout
 * 6. **RuntimeDebugConfiguration** - Debug configuration management
 * 7. **RuntimeEntityOperations** - Entity and rendering operations
 *
 * ## Design Principles
 *
 * - ✅ Single Responsibility: Each module handles a single domain
 * - ✅ Dependency Injection: Modules coupled via constructor injection
 * - ✅ Facade Coordination: Main class delegates all business logic
 * - ✅ Backward Compatible: All public APIs remain unchanged
 *
 * @class KoduckFlowRuntime
 * @implements {IDisposable}
 * @since v2.0.0 - Modular architecture refactoring completed
 * @example
 * ```typescript
 * const runtime = new KoduckFlowRuntime(container, {
 *   initializeManagers: true
 * });
 * const entityManager = runtime.EntityManager;
 * const result = await runtime.executeFlow(flow, context);
 * runtime.dispose();
 * ```
 */
export class KoduckFlowRuntime implements IDisposable {
  // ==================== Public Fields ====================
  readonly container: IDependencyContainer;

  // ==================== Core Modules (Delegation Targets) ====================
  private readonly _containerManager: RuntimeContainerManager;
  private readonly _managerCoordinator: RuntimeManagerCoordinator;
  private readonly _tenantContext: RuntimeTenantContext;
  private readonly _quotaManager: RuntimeQuotaManager;
  private readonly _featureFlag: RuntimeFeatureFlag;
  private readonly _debugConfig: RuntimeDebugConfiguration;
  private readonly _entityOperations: RuntimeEntityOperations;

  // ==================== Lifecycle State ====================
  private disposed = false;

  /**
   *
   */
  constructor(
    container: IDependencyContainer,
    initializationOptions?: ManagerInitializationOptions
  ) {
    this.container = container;

    // Initialize container manager (resolves and caches all core services)
    this._containerManager = new RuntimeContainerManager(container);

    // Initialize tenant context
    this._tenantContext = new RuntimeTenantContext(container);

    // Initialize quota manager with provider functions
    this._quotaManager = new RuntimeQuotaManager(
      () => this._tenantContext.getTenantContext() ?? null,
      () => this._containerManager.getEntityManager().getEntities().length
    );

    // Initialize feature flag manager with provider function
    this._featureFlag = new RuntimeFeatureFlag(
      () => this._tenantContext.getTenantContext() ?? null
    );

    // Initialize debug configuration
    this._debugConfig = new RuntimeDebugConfiguration({
      eventBus: this._containerManager.getEventBus(),
      renderEvents: this._containerManager.getRenderEvents(),
      entityEvents: this._containerManager.getEntityEvents(),
    });

    // Initialize manager coordinator
    this._managerCoordinator = new RuntimeManagerCoordinator(initializationOptions, [
      ...CORE_MANAGER_KEYS,
    ]);

    // Initialize entity operations (facade for entity and render shortcuts)
    this._entityOperations = new RuntimeEntityOperations(
      this._containerManager.getEntityManager(),
      this._containerManager.getRenderManager(),
      this._quotaManager
    );

    // Connect managers
    const renderManager = this._containerManager.getRenderManager();
    renderManager.connectToEntityManager(this._containerManager.getEntityManager());
    renderManager.connectToRegistryManager(this._containerManager.getRegistryManager());
  }

  // ==================== DI Container Operations (delegated to RuntimeContainerManager) ====================

  /**
   *
   */
  resolve<T>(token: string | symbol): T {
    return this._containerManager.resolve<T>(token);
  }

  /**
   *
   */
  has(token: string | symbol): boolean {
    return this._containerManager.has(token);
  }

  // ==================== Manager Management (delegated to RuntimeManagerCoordinator) ====================

  /**
   *
   */
  registerManager(name: string, manager: IManager, options: ManagerRegistrationOptions = {}): void {
    // If not in lazy mode, validate core manager dependencies in advance
    // RuntimeManagerCoordinator only knows custom managers, so we check core managers here
    if (!options.lazy && options.dependencies) {
      for (const dependency of options.dependencies) {
        if (!this.hasManager(dependency)) {
          throw new ManagerInitializationError(name, `missing dependency '${dependency}'`, {
            path: [name, dependency],
          });
        }
      }
    }

    this._managerCoordinator.registerManager(name, manager, options);
  }

  /**
   *
   */
  unregisterManager(name: string): void {
    this._managerCoordinator.unregisterManager(name);
  }

  /**
   *
   */
  getManager<T extends IManager = IManager>(name: string): T | undefined {
    if (CORE_MANAGER_KEYS.includes(name as CoreManagerKey)) {
      return this._resolveCoreManager(name as CoreManagerKey) as T;
    }

    return this._managerCoordinator.getManager<T>(name);
  }

  /**
   *
   */
  hasManager(name: string): boolean {
    if (CORE_MANAGER_KEYS.includes(name as CoreManagerKey)) {
      return true;
    }

    return this._managerCoordinator.hasManager(name);
  }

  /**
   *
   */
  getRegisteredManagers(): string[] {
    const customManagers = this._managerCoordinator.getRegisteredManagers();
    return [...CORE_MANAGER_KEYS, ...customManagers];
  }

  /**
   *
   */
  getInitializedManagers(): string[] {
    const customManagers = this._managerCoordinator.getInitializedManagers();
    return [...CORE_MANAGER_KEYS, ...customManagers];
  }

  // ==================== Core Service Getters (delegated to RuntimeContainerManager) ====================

  /**
   *
   */
  get EntityManager(): EntityManager {
    return this._containerManager.getEntityManager();
  }

  /**
   *
   */
  get RenderManager(): RenderManager {
    return this._containerManager.getRenderManager();
  }

  /**
   *
   */
  get RegistryManager(): RegistryManager {
    return this._containerManager.getRegistryManager();
  }

  /**
   *
   */
  get EventBus(): EventBus {
    return this._containerManager.getEventBus();
  }

  /**
   *
   */
  get RenderEvents(): RenderEventManager {
    return this._containerManager.getRenderEvents();
  }

  /**
   *
   */
  get EntityEvents(): EntityEventManager<IEntity> {
    return this._containerManager.getEntityEvents();
  }

  /**
   * Get the Worker Pool Manager instance (if registered)
   *
   * @returns WorkerPoolManager instance or undefined if not registered
   *
   * @description
   * Provides convenient access to the Worker Pool Manager from the DI container.
   * Used for submitting tasks to the worker pool and managing concurrent execution.
   *
   * @example
   * ```typescript
   * const runtime = new KoduckFlowRuntime(container);
   * const poolManager = runtime.WorkerPoolManager;
   * if (poolManager) {
   *   const result = await poolManager.submit({
   *     type: 'compute',
   *     payload: { value: 42 }
   *   });
   * }
   * ```
   */
  get WorkerPoolManager() {
    return this._containerManager.getWorkerPoolManager();
  }

  // ==================== Optional Manager Getters ====================

  /**
   *
   */
  get InteractionManager() {
    return this.getManager("interaction");
  }

  /**
   *
   */
  get CommandManager() {
    return this.getManager("command");
  }

  // ==================== Debug Configuration (delegated to RuntimeDebugConfiguration) ====================

  /**
   *
   */
  configureDebug(options?: DebugOptions): void {
    this._debugConfig.configureDebug(options);
  }

  /**
   *
   */
  getDebugOptions(): DebugOptions | undefined {
    return this._debugConfig.getDebugOptions();
  }

  /**
   *
   */
  get SpatialManager() {
    return this.getManager("spatial");
  }

  // ==================== Tenant Context (delegated to RuntimeTenantContext) ====================

  /**
   *
   */
  setTenantContext(context?: ResolvedTenantContext | null): void {
    this._tenantContext.setTenantContext(context);
    this._quotaManager.clear();
    if (context) {
      this._quotaManager.syncEntityQuotaUsage();
    }
  }

  /**
   *
   */
  getTenantContext(): ResolvedTenantContext | undefined {
    return this._tenantContext.getTenantContext();
  }

  // ==================== Quota Management (delegated to RuntimeQuotaManager) ====================

  /**
   *
   */
  claimTenantQuota(bucket: string, amount = 1): boolean {
    return this._quotaManager.claimQuota(bucket, amount);
  }

  /**
   *
   */
  releaseTenantQuota(bucket: string, amount = 1): number {
    return this._quotaManager.releaseQuota(bucket, amount);
  }

  /**
   *
   */
  getTenantQuotaSnapshot(bucket: string): TenantQuotaSnapshot | undefined {
    return this._quotaManager.getQuotaSnapshot(bucket);
  }

  /**
   *
   */
  listTenantQuotaSnapshots(): TenantQuotaSnapshot[] {
    return this._quotaManager.listQuotaSnapshots();
  }

  // ==================== Feature Flags (delegated to RuntimeFeatureFlag) ====================

  /**
   *
   */
  isTenantFeatureEnabled(flag: string, defaultValue = false): boolean {
    return this._featureFlag.isFeatureEnabled(flag, defaultValue);
  }

  /**
   *
   */
  getTenantRolloutVariant(): string | undefined {
    return this._featureFlag.getRolloutVariant();
  }

  /**
   *
   */
  getTenantRolloutCohort(): string | undefined {
    return this._featureFlag.getRolloutCohort();
  }

  /**
   *
   */
  isTenantInRollout(seed?: string): boolean {
    return this._featureFlag.isInRollout(seed);
  }

  // ==================== Entity Operations (delegated to RuntimeEntityOperations) ====================

  /**
   *
   */
  createEntity<T extends IEntity = IEntity>(typeName: string, args?: IEntityArguments): T | null {
    return this._entityOperations.createEntity<T>(typeName, args);
  }

  /**
   *
   */
  getEntity<T extends IEntity = IEntity>(id: string): T | undefined {
    return this._entityOperations.getEntity<T>(id);
  }

  /**
   *
   */
  removeEntity(id: string): boolean {
    return this._entityOperations.removeEntity(id);
  }

  /**
   *
   */
  hasEntity(id: string): boolean {
    return this._entityOperations.hasEntity(id);
  }

  /**
   *
   */
  getEntities(): IEntity[] {
    return this._entityOperations.getEntities();
  }

  /**
   *
   */
  removeEntities(ids: string[]): number {
    return this._entityOperations.removeEntities(ids);
  }

  // ==================== Render Operations (delegated to RuntimeEntityOperations) ====================

  /**
   *
   */
  addEntityToRender(entity: IEntity): void {
    this._entityOperations.addEntityToRender(entity);
  }

  /**
   *
   */
  removeEntityFromRender(entityId: string): void {
    this._entityOperations.removeEntityFromRender(entityId);
  }

  /**
   *
   */
  getEntityRenderElement(
    entityId: string
  ): React.ReactElement | string | Promise<string> | null | void {
    return this._entityOperations.getEntityRenderElement(entityId);
  }

  // ==================== Lifecycle Management ====================

  /**
   *
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this._managerCoordinator.dispose();
    this._containerManager.getRenderManager().dispose();
    this._containerManager.getRegistryManager().dispose();
    this._containerManager.dispose();

    this.container.dispose();

    this.disposed = true;
  }

  // ==================== Configuration ====================

  /**
   *
   */
  getManagerInitializationDefaults(): ManagerInitializationOptions {
    return this._managerCoordinator.getManagerInitializationDefaults();
  }

  /**
   * Resolve core Manager
   * Use Map mapping to improve readability and performance
   */
  private _resolveCoreManager(key: CoreManagerKey): IManager {
    const coreManagers = this._containerManager.getCoreManagers();
    const manager = coreManagers[key];
    if (!manager) {
      throw new Error(`Unknown core manager key: ${key}`);
    }
    return manager;
  }
}

/**
 * Create a new KoduckFlow runtime instance with configuration
 * @param {KoduckFlowRuntimeOptions} [options={}] - Runtime initialization options
 * @param {IDependencyContainer} [options.container] - Custom DI container or creates new one
 * @param {CoreServiceOverrides} [options.overrides] - Override core service implementations
 * @param {boolean} [options.enableMetrics=false] - Enable metrics collection
 * @param {boolean} [options.enableCache=true] - Enable caching layer
 * @param {ManagerInitializationOptions} [options.managerInitialization] - Manager initialization options
 * @returns {KoduckFlowRuntime} Configured runtime instance ready for use
 * @example
 * ```typescript
 * const runtime = createKoduckFlowRuntime({
 *   enableMetrics: true,
 *   enableCache: true,
 *   overrides: { entityManager: CustomEntityManager }
 * });
 * ```
 */
export function createKoduckFlowRuntime(options: KoduckFlowRuntimeOptions = {}): KoduckFlowRuntime {
  const container = options.container ?? createCoreContainer(options.overrides);

  if (options.container && options.overrides) {
    registerCoreServices(container, options.overrides);
  }

  const runtime = new KoduckFlowRuntime(container, options.managerInitialization);
  registerRuntimeInstance(container, runtime);
  return runtime;
}

/**
 * Create a scoped runtime child instance from parent runtime for multi-tenancy
 * Scoped runtime shares parent container services with optional overrides
 * @param {KoduckFlowRuntime} parentRuntime - Parent runtime to scope from
 * @param {CoreServiceOverrides} [overrides] - Override core services in scoped context
 * @param {Object} [options] - Additional runtime options
 * @param {ManagerInitializationOptions} [options.managerInitialization] - Manager initialization options
 * @returns {KoduckFlowRuntime} New scoped runtime instance sharing parent services
 * @example
 * ```typescript
 * const parentRuntime = createKoduckFlowRuntime();
 * const scopedRuntime = createScopedRuntime(parentRuntime, {
 *   // Override services for this scope
 * });
 * // Scoped runtime inherits parent managers but with isolated context
 * ```
 */
export function createScopedRuntime(
  parentRuntime: KoduckFlowRuntime,
  overrides?: CoreServiceOverrides,
  options?: Pick<KoduckFlowRuntimeOptions, "managerInitialization">
): KoduckFlowRuntime {
  const scopedContainer = parentRuntime.container.createScope();

  registerCoreServices(scopedContainer, overrides);

  const initializationOptions =
    options?.managerInitialization ?? parentRuntime.getManagerInitializationDefaults();

  const runtime = new KoduckFlowRuntime(scopedContainer, initializationOptions);
  registerRuntimeInstance(scopedContainer, runtime);
  return runtime;
}
