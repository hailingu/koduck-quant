/**
 * @file RuntimeManagerCoordinator
 * Provides Manager coordination functionality
 *
 * Responsibilities:
 * - Manage custom Manager registration and unregistration
 * - Handle Manager initialization logic (dependency resolution, retry, timeout)
 * - Manage Manager lifecycle state machine
 *
 * Usage scenarios:
 * ```typescript
 * const coordinator = new RuntimeManagerCoordinator({
 *   retries: { attempts: 3, delayMs: 100 },
 *   timeoutMs: 5000
 * }, ['entity', 'render', 'registry']);
 *
 * coordinator.registerManager('spatial', spatialManager, {
 *   dependencies: ['entity'],
 *   lazy: false
 * });
 *
 * await coordinator.initializeManager('spatial');
 * ```
 *
 * @module RuntimeManagerCoordinator
 * @since Phase 2.6
 */

import { logger } from "../logger";
import type { IDisposable } from "../disposable";
import type { IManager } from "../manager/types";
import type {
  ManagerRegistrationOptions,
  ManagerInitializationOptions,
  NormalizedManagerInitializationConfig,
  ManagerLifecycleState,
} from "./types";
import {
  MANAGER_LIFECYCLE_STATUS,
  DEFAULT_MANAGER_INITIALIZATION_CONFIG,
  INITIALIZATION_TIMEOUT_FLAG,
  ManagerInitializationError,
} from "./types";

/**
 * RuntimeManagerCoordinator class
 * Responsible for Manager registration, initialization, and lifecycle management
 *
 * @example
 * ```typescript
 * const coordinator = new RuntimeManagerCoordinator({
 *   retries: { attempts: 3, delayMs: 100 },
 *   timeoutMs: 5000,
 *   warnOnRetry: true
 * }, ['entity', 'render', 'registry']);
 *
 * // Register Manager
 * coordinator.registerManager('spatial', spatialManager, {
 *   dependencies: ['entity'],
 *   lazy: false
 * });
 *
 * // Initialize Manager
 * await coordinator.initializeManager('spatial');
 *
 * // Get Manager
 * const spatial = coordinator.getManager('spatial');
 *
 * // Unregister Manager
 * coordinator.unregisterManager('spatial');
 * ```
 */
export class RuntimeManagerCoordinator implements IDisposable {
  /**
   * Registered Manager mapping
   * @private
   */
  private readonly managers = new Map<string, IManager>();

  /**
   * Manager registration options mapping
   * @private
   */
  private readonly managerOptions = new Map<string, ManagerRegistrationOptions>();

  /**
   * Initialized Manager set
   * @private
   */
  private readonly initializedManagers = new Set<string>();

  /**
   * Manager lifecycle state mapping
   * @private
   */
  private readonly managerStates = new Map<string, ManagerLifecycleState>();

  /**
   * Manager dependency mapping
   * @private
   */
  private readonly dependencies = new Map<string, string[]>();

  /**
   * Manager initialization default config
   * @private
   */
  private readonly initializationDefaults: NormalizedManagerInitializationConfig;

  /**
   * Core Manager key set (cannot be unregistered)
   * @private
   */
  private readonly coreManagerKeys: Set<string>;

  /**
   * Whether disposed
   * @private
   */
  private disposed = false;

  /**
   * Create RuntimeManagerCoordinator instance
   *
   * @param initializationOptions - Manager initialization options
   * @param coreManagerKeys - Core Manager key list (these Managers cannot be unregistered)
   *
   * @example
   * ```typescript
   * const coordinator = new RuntimeManagerCoordinator({
   *   retries: { attempts: 3, delayMs: 100 },
   *   timeoutMs: 5000,
   *   warnOnRetry: true
   * }, ['entity', 'render', 'registry']);
   * ```
   */
  constructor(
    initializationOptions?: ManagerInitializationOptions,
    coreManagerKeys: string[] = []
  ) {
    this.initializationDefaults = this.normalizeInitializationOptions(initializationOptions);
    this.coreManagerKeys = new Set(coreManagerKeys);
  }

  /**
   * Register a Manager
   *
   * This method will:
   * 1. Verify Manager name is not a core Manager
   * 2. Check if Manager is already registered
   * 3. Register Manager and set status to Registered
   * 4. Record dependency relationships
   * 5. If not lazy-loaded, initialize Manager immediately
   *
   * @param name - Manager name
   * @param manager - Manager instance
   * @param options - Registration options
   *
   * @example
   * ```typescript
   * coordinator.registerManager('spatial', spatialManager, {
   *   dependencies: ['entity', 'render'],
   *   lazy: false,
   *   initialization: {
   *     retries: { attempts: 5, delayMs: 200 },
   *     timeoutMs: 10000
   *   }
   * });
   * ```
   */
  registerManager(name: string, manager: IManager, options: ManagerRegistrationOptions = {}): void {
    if (this.coreManagerKeys.has(name)) {
      logger.warn(`Manager '${name}' is a core manager and cannot be re-registered.`);
      return;
    }

    if (this.managers.has(name)) {
      logger.warn(`Manager '${name}' is already registered. Skipping registration.`);
      return;
    }

    // If not lazy mode, validate dependencies immediately
    if (!options.lazy && options.dependencies) {
      for (const dependency of options.dependencies) {
        if (!this.managers.has(dependency) && !this.coreManagerKeys.has(dependency)) {
          throw new ManagerInitializationError(name, `missing dependency '${dependency}'`, {
            path: [name, dependency],
          });
        }
      }
    }

    this.managers.set(name, manager);
    this.managerOptions.set(name, options);
    this.managerStates.set(name, { status: MANAGER_LIFECYCLE_STATUS.Registered });

    if (options.dependencies) {
      this.dependencies.set(name, options.dependencies);
    }

    if (!options.lazy) {
      const eagerInitialization = this.initializeManager(name);
      const dependencies = this.dependencies.get(name) ?? [];
      eagerInitialization.catch((error) => {
        const state = this.managerStates.get(name);
        const path = state?.path ?? [name];
        logger.error("[koduck-flow] Manager eager initialization failed", {
          manager: name,
          dependencies,
          path,
          origin: "registerManager",
          error,
        });
      });
    }
  }

  /**
   * Unregister a Manager
   *
   * This method will:
   * 1. Verify Manager is not a core Manager
   * 2. Call Manager's dispose method
   * 3. Remove Manager from all mappings
   *
   * @param name - Manager name
   *
   * @example
   * ```typescript
   * coordinator.unregisterManager('spatial');
   * ```
   */
  unregisterManager(name: string): void {
    if (this.coreManagerKeys.has(name)) {
      logger.warn(`Cannot unregister core manager '${name}'`);
      return;
    }

    const manager = this.managers.get(name);
    if (!manager) {
      return;
    }

    manager.dispose();
    this.managers.delete(name);
    this.managerOptions.delete(name);
    this.dependencies.delete(name);
    this.initializedManagers.delete(name);
    this.managerStates.delete(name);
  }

  /**
   * Get Manager by specified name
   *
   * If Manager is not initialized, triggers initialization (async)
   * If initialization previously failed, throws ManagerInitializationError
   *
   * @param name - Manager name
   * @returns Manager instance, or undefined if not found
   * @throws {ManagerInitializationError} If Manager initialization fails
   *
   * @example
   * ```typescript
   * const spatial = coordinator.getManager<SpatialManager>('spatial');
   * if (spatial) {
   *   spatial.query({ x: 0, y: 0 });
   * }
   * ```
   */
  getManager<T extends IManager = IManager>(name: string): T | undefined {
    const manager = this.managers.get(name);
    if (!manager) {
      return undefined;
    }

    // Check if initialization failed
    const state = this.managerStates.get(name);
    if (state?.status === MANAGER_LIFECYCLE_STATUS.Failed) {
      const error = state.error;
      const statePath = state.path ?? [name];
      throw new ManagerInitializationError(
        name,
        "initialization previously failed",
        error === undefined ? { path: statePath } : { cause: error, path: statePath }
      );
    }

    if (!this.initializedManagers.has(name)) {
      this.initializeManager(name).catch(() => undefined);
    }

    return manager as T;
  }

  /**
   * Check if Manager with specified name is registered
   *
   * @param name - Manager name
   * @returns true if registered, false otherwise
   *
   * @example
   * ```typescript
   * if (coordinator.hasManager('spatial')) {
   *   console.log('Spatial manager is registered');
   * }
   * ```
   */
  hasManager(name: string): boolean {
    return this.managers.has(name);
  }

  /**
   * Get list of all registered Manager names
   *
   * @returns Array of Manager names
   *
   * @example
   * ```typescript
   * const registered = coordinator.getRegisteredManagers();
   * console.log('Registered managers:', registered);
   * ```
   */
  getRegisteredManagers(): string[] {
    return Array.from(this.managers.keys());
  }

  /**
   * Get list of all initialized Manager names
   *
   * @returns Array of initialized Manager names
   *
   * @example
   * ```typescript
   * const initialized = coordinator.getInitializedManagers();
   * console.log('Initialized managers:', initialized);
   * ```
   */
  getInitializedManagers(): string[] {
    return Array.from(this.initializedManagers);
  }

  /**
   * Initialize Manager with specified name
   *
   * This method will:
   * 1. Check if Manager is already initialized
   * 2. Check Manager current status
   * 3. Resolve and initialize dependencies
   * 4. Call Manager's initialize method (if exists)
   * 5. Handle retry and timeout logic
   * 6. Update Manager status
   *
   * @param name - Manager name
   * @returns Promise that resolves when initialization completes
   * @throws {ManagerInitializationError} If initialization fails
   *
   * @example
   * ```typescript
   * try {
   *   await coordinator.initializeManager('spatial');
   *   console.log('Spatial manager initialized successfully');
   * } catch (error) {
   *   console.error('Failed to initialize spatial manager:', error);
   * }
   * ```
   */
  initializeManager(name: string): Promise<void> {
    return this.initializeManagerInternal(name, []);
  }

  /**
   * Get Manager initialization default config
   *
   * @returns Manager initialization options
   *
   * @example
   * ```typescript
   * const defaults = coordinator.getManagerInitializationDefaults();
   * console.log('Default retries:', defaults.retries);
   * ```
   */
  getManagerInitializationDefaults(): ManagerInitializationOptions {
    const defaults: ManagerInitializationOptions = {
      retries: {
        attempts: this.initializationDefaults.retries.attempts,
        delayMs: this.initializationDefaults.retries.delayMs,
      },
      warnOnRetry: this.initializationDefaults.warnOnRetry,
    };

    if (this.initializationDefaults.timeoutMs !== undefined) {
      defaults.timeoutMs = this.initializationDefaults.timeoutMs;
    }

    return defaults;
  }

  /**
   * Dispose RuntimeManagerCoordinator and all managed Managers
   *
   * @example
   * ```typescript
   * coordinator.dispose();
   * ```
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    for (const manager of this.managers.values()) {
      manager.dispose();
    }

    this.managers.clear();
    this.managerOptions.clear();
    this.initializedManagers.clear();
    this.managerStates.clear();
    this.dependencies.clear();
    this.disposed = true;
  }

  /**
   * Internal implementation of Manager initialization (supports dependency path tracking)
   *
   * @param name - Manager name
   * @param path - Dependency path (used for circular dependency detection)
   * @returns Promise that resolves when initialization completes
   * @throws {ManagerInitializationError} If initialization fails
   * @private
   */
  private initializeManagerInternal(name: string, path: string[]): Promise<void> {
    if (this.initializedManagers.has(name)) {
      return Promise.resolve();
    }

    const existingStatePromise = this.handleExistingManagerState(name, path);
    if (existingStatePromise) {
      return existingStatePromise;
    }

    const manager = this.managers.get(name);
    if (!manager) {
      return Promise.reject(
        new ManagerInitializationError(name, "is not registered", { path: path.concat(name) })
      );
    }

    const dependencies = this.dependencies.get(name) ?? [];
    try {
      this.validateDependencies(name, path, dependencies);
    } catch (error) {
      return Promise.reject(error as Error);
    }

    const initializationPath = [...path, name];
    const initialization = this.runManagerInitialization(
      manager,
      name,
      initializationPath,
      dependencies
    )
      .then(() => {
        this.managerStates.set(name, { status: MANAGER_LIFECYCLE_STATUS.Ready });
        this.initializedManagers.add(name);
        logger.info("[koduck-flow] Manager initialized", {
          manager: name,
          dependencies,
          path: initializationPath,
          origin: "initializeManager",
        });
      })
      .catch((error) => {
        this.managerStates.set(name, {
          status: MANAGER_LIFECYCLE_STATUS.Failed,
          error,
          path: initializationPath,
        });
        this.initializedManagers.delete(name);
        logger.error("[koduck-flow] Manager initialization failed", {
          manager: name,
          dependencies,
          path: initializationPath,
          origin: "initializeManager",
          error,
        });
        throw error;
      });

    this.managerStates.set(name, {
      status: MANAGER_LIFECYCLE_STATUS.Initializing,
      promise: initialization,
      path: initializationPath,
    });

    return initialization;
  }

  /**
   * Handle existing Manager state
   * @private
   */
  private handleExistingManagerState(name: string, path: string[]): Promise<void> | null {
    const existingState = this.managerStates.get(name);
    if (!existingState) {
      return null;
    }

    switch (existingState.status) {
      case MANAGER_LIFECYCLE_STATUS.Ready:
        return existingState.promise ?? Promise.resolve();
      case MANAGER_LIFECYCLE_STATUS.Initializing:
        return existingState.promise ?? null;
      case MANAGER_LIFECYCLE_STATUS.Failed: {
        const error = existingState.error;
        const statePath = existingState.path ?? path.concat(name);
        throw new ManagerInitializationError(
          name,
          "initialization previously failed",
          error === undefined ? { path: statePath } : { cause: error, path: statePath }
        );
      }
      default:
        return null;
    }
  }

  /**
   * Validate Manager dependencies
   * @private
   */
  private validateDependencies(name: string, path: string[], dependencies: string[]): void {
    for (const dependency of dependencies) {
      if (!this.hasManager(dependency)) {
        const missingPath = [...path, name, dependency];
        throw new ManagerInitializationError(name, `missing dependency '${dependency}'`, {
          path: missingPath,
        });
      }

      if (path.includes(dependency)) {
        const cyclePath = [...path, name, dependency];
        throw new ManagerInitializationError(name, "circular dependency detected", {
          path: cyclePath,
        });
      }
    }
  }

  /**
   * Run Manager initialization flow
   *
   * @param manager - Manager instance
   * @param name - Manager name
   * @param path - Dependency path
   * @param dependencies - Dependency list
   * @returns Promise that resolves when initialization completes
   * @throws {ManagerInitializationError} If initialization fails
   * @private
   */
  private async runManagerInitialization(
    manager: IManager,
    name: string,
    path: string[],
    dependencies: string[]
  ): Promise<void> {
    if (dependencies.length > 0) {
      logger.debug("[koduck-flow] Resolving manager dependencies", {
        name,
        dependencies,
        path,
      });
    }

    for (const dependency of dependencies) {
      try {
        await this.initializeManagerInternal(dependency, path);
      } catch (error) {
        const dependencyPath = [...path, dependency];
        throw new ManagerInitializationError(
          name,
          `dependency '${dependency}' failed to initialize`,
          error instanceof Error ? { cause: error, path: dependencyPath } : { path: dependencyPath }
        );
      }
    }

    if (!manager.initialize) {
      return;
    }

    const config = this.resolveInitializationConfig(name);
    await this.invokeManagerInitialize(manager, name, path, config);
  }

  /**
   * Resolve Manager initialization config
   *
   * @param name - Manager name
   * @returns Normalized initialization config
   * @private
   */
  private resolveInitializationConfig(name: string): NormalizedManagerInitializationConfig {
    const registrationOptions = this.managerOptions.get(name)?.initialization;
    const defaults = this.initializationDefaults;

    const attempts = Math.max(
      1,
      registrationOptions?.retries?.attempts ?? defaults.retries.attempts
    );
    const delayMs = Math.max(0, registrationOptions?.retries?.delayMs ?? defaults.retries.delayMs);
    const resolved: NormalizedManagerInitializationConfig = {
      retries: {
        attempts,
        delayMs,
      },
      warnOnRetry: registrationOptions?.warnOnRetry ?? defaults.warnOnRetry,
    };

    const timeout =
      registrationOptions?.timeoutMs === undefined
        ? defaults.timeoutMs
        : Math.max(0, registrationOptions.timeoutMs);

    if (timeout !== undefined) {
      resolved.timeoutMs = timeout;
    }

    return resolved;
  }

  /**
   * Invoke Manager's initialize method (with retry support)
   *
   * @param manager - Manager instance
   * @param name - Manager name
   * @param path - Dependency path
   * @param config - Initialization config
   * @returns Promise that resolves when initialization completes
   * @throws {ManagerInitializationError} If initialization fails
   * @private
   */
  private async invokeManagerInitialize(
    manager: IManager,
    name: string,
    path: string[],
    config: NormalizedManagerInitializationConfig
  ): Promise<void> {
    const initialize = () =>
      Promise.resolve(manager.initialize!.call(manager)).then(() => undefined);
    const attempts = Math.max(1, config.retries.attempts);

    await this.retryManagerInitialization(initialize, config, name, path, attempts);
  }

  /**
   * Encapsulates Manager initialization retry logic to reduce complexity of invokeManagerInitialize
   *
   * @param initialize - Initialization function
   * @param config - Initialization config
   * @param name - Manager name
   * @param path - Dependency path
   * @param attempts - Total attempt count
   * @private
   */
  private async retryManagerInitialization(
    initialize: () => Promise<void>,
    config: NormalizedManagerInitializationConfig,
    name: string,
    path: string[],
    attempts: number
  ): Promise<void> {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      logger.debug("[koduck-flow] Initializing manager", {
        name,
        path,
        attempt,
        attempts,
      });

      try {
        await this.executeInitializationAttempt(initialize, config, name, path, attempt, attempts);
        return;
      } catch (error) {
        if (attempt < attempts) {
          await this.handleFailedInitializationAttempt(
            error,
            config,
            name,
            path,
            attempt,
            attempts
          );
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Handle failed initialization attempt
   * @private
   */
  private async handleFailedInitializationAttempt(
    error: unknown,
    config: NormalizedManagerInitializationConfig,
    name: string,
    path: string[],
    attempt: number,
    attempts: number
  ): Promise<void> {
    const isTimeoutError = this.isInitializationTimeoutError(error);
    if (config.warnOnRetry && !isTimeoutError) {
      logger.warn("[koduck-flow] Manager initialization attempt failed", {
        name,
        attempt,
        attempts,
        path,
        delayMs: config.retries.delayMs,
        error,
      });
    }

    if (config.retries.delayMs > 0) {
      await this.sleep(config.retries.delayMs);
    }
  }

  /**
   * Execute single initialization attempt (with timeout support)
   *
   * @param task - Initialization task
   * @param config - Initialization config
   * @param name - Manager name
   * @param path - Dependency path
   * @param attempt - Current attempt number
   * @param attempts - Total attempt count
   * @returns Promise that resolves when initialization completes
   * @throws {Error} If initialization times out or fails
   * @private
   */
  private async executeInitializationAttempt(
    task: () => Promise<void>,
    config: NormalizedManagerInitializationConfig,
    name: string,
    path: string[],
    attempt: number,
    attempts: number
  ): Promise<void> {
    if (!config.timeoutMs || config.timeoutMs <= 0) {
      await task();
      return;
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const timeoutError = new Error(
          `Manager '${name}' initialization timed out after ${config.timeoutMs}ms`
        );
        timeoutError.name = "ManagerInitializationTimeoutError";
        Object.defineProperty(timeoutError, INITIALIZATION_TIMEOUT_FLAG, {
          configurable: false,
          enumerable: false,
          value: true,
        });

        if (config.warnOnRetry) {
          logger.warn("[koduck-flow] Manager initialization attempt timed out", {
            name,
            attempt,
            attempts,
            timeoutMs: config.timeoutMs,
            path,
            error: timeoutError,
          });
        }

        reject(timeoutError);
      }, config.timeoutMs);

      const possibleTimer = timeoutHandle as unknown as { unref?: () => void } | undefined;
      possibleTimer?.unref?.();
    });

    try {
      await Promise.race([task(), timeoutPromise]);
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Check if error is an initialization timeout error
   *
   * @param error - Error object
   * @returns true if timeout error, false otherwise
   * @private
   */
  private isInitializationTimeoutError(error: unknown): boolean {
    return Boolean(error && typeof error === "object" && INITIALIZATION_TIMEOUT_FLAG in error);
  }

  /**
   * Normalize initialization options
   *
   * @param options - Initialization options
   * @returns Normalized initialization config
   * @private
   */
  private normalizeInitializationOptions(
    options?: ManagerInitializationOptions
  ): NormalizedManagerInitializationConfig {
    const attempts = Math.max(
      1,
      options?.retries?.attempts ?? DEFAULT_MANAGER_INITIALIZATION_CONFIG.retries.attempts
    );
    const delayMs = Math.max(
      0,
      options?.retries?.delayMs ?? DEFAULT_MANAGER_INITIALIZATION_CONFIG.retries.delayMs
    );

    const normalized: NormalizedManagerInitializationConfig = {
      retries: {
        attempts,
        delayMs,
      },
      warnOnRetry: options?.warnOnRetry ?? DEFAULT_MANAGER_INITIALIZATION_CONFIG.warnOnRetry,
    };

    const timeout = options?.timeoutMs ?? DEFAULT_MANAGER_INITIALIZATION_CONFIG.timeoutMs;
    if (timeout !== undefined) {
      normalized.timeoutMs = Math.max(0, timeout);
    }

    return normalized;
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param delayMs - Delay in milliseconds
   * @returns Promise that resolves after delay
   * @private
   */
  private async sleep(delayMs: number): Promise<void> {
    await new Promise<void>((resolve) => {
      const handle = setTimeout(resolve, delayMs);
      const possibleTimer = handle as unknown as { unref?: () => void } | undefined;
      possibleTimer?.unref?.();
    });
  }
}
