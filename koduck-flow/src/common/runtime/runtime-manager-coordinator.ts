/**
 * @fileoverview RuntimeManagerCoordinator
 * 提供 Manager 协调管理功能
 *
 * 职责:
 * - 管理自定义 Manager 的注册与卸载
 * - 处理 Manager 初始化逻辑（依赖解析、重试、超时）
 * - 管理 Manager 生命周期状态机
 *
 * 使用场景:
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
 * RuntimeManagerCoordinator 类
 * 负责 Manager 的注册、初始化和生命周期管理
 *
 * @example
 * ```typescript
 * const coordinator = new RuntimeManagerCoordinator({
 *   retries: { attempts: 3, delayMs: 100 },
 *   timeoutMs: 5000,
 *   warnOnRetry: true
 * }, ['entity', 'render', 'registry']);
 *
 * // 注册 Manager
 * coordinator.registerManager('spatial', spatialManager, {
 *   dependencies: ['entity'],
 *   lazy: false
 * });
 *
 * // 初始化 Manager
 * await coordinator.initializeManager('spatial');
 *
 * // 获取 Manager
 * const spatial = coordinator.getManager('spatial');
 *
 * // 卸载 Manager
 * coordinator.unregisterManager('spatial');
 * ```
 */
export class RuntimeManagerCoordinator implements IDisposable {
  /**
   * 已注册的 Manager 映射
   * @private
   */
  private readonly managers = new Map<string, IManager>();

  /**
   * Manager 注册选项映射
   * @private
   */
  private readonly managerOptions = new Map<string, ManagerRegistrationOptions>();

  /**
   * 已初始化的 Manager 集合
   * @private
   */
  private readonly initializedManagers = new Set<string>();

  /**
   * Manager 生命周期状态映射
   * @private
   */
  private readonly managerStates = new Map<string, ManagerLifecycleState>();

  /**
   * Manager 依赖关系映射
   * @private
   */
  private readonly dependencies = new Map<string, string[]>();

  /**
   * Manager 初始化默认配置
   * @private
   */
  private readonly initializationDefaults: NormalizedManagerInitializationConfig;

  /**
   * 核心 Manager 键集合（不可卸载）
   * @private
   */
  private readonly coreManagerKeys: Set<string>;

  /**
   * 是否已释放
   * @private
   */
  private disposed = false;

  /**
   * 创建 RuntimeManagerCoordinator 实例
   *
   * @param initializationOptions - Manager 初始化选项
   * @param coreManagerKeys - 核心 Manager 键列表（这些 Manager 不可被卸载）
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
   * 注册一个 Manager
   *
   * 此方法会:
   * 1. 验证 Manager 名称不是核心 Manager
   * 2. 检查 Manager 是否已注册
   * 3. 注册 Manager 并设置状态为 Registered
   * 4. 记录依赖关系
   * 5. 如果不是懒加载，立即初始化 Manager
   *
   * @param name - Manager 名称
   * @param manager - Manager 实例
   * @param options - 注册选项
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

    // 如果不是 lazy 模式，立即验证依赖是否存在
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
   * 卸载一个 Manager
   *
   * 此方法会:
   * 1. 验证 Manager 不是核心 Manager
   * 2. 调用 Manager 的 dispose 方法
   * 3. 从所有映射表中移除 Manager
   *
   * @param name - Manager 名称
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
   * 获取指定名称的 Manager
   *
   * 如果 Manager 未初始化，会触发初始化（异步）
   * 如果初始化曾经失败，会抛出 ManagerInitializationError
   *
   * @param name - Manager 名称
   * @returns Manager 实例，如果不存在则返回 undefined
   * @throws {ManagerInitializationError} 如果 Manager 初始化失败
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

    // 检查是否初始化失败
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
   * 检查指定名称的 Manager 是否已注册
   *
   * @param name - Manager 名称
   * @returns 如果已注册返回 true，否则返回 false
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
   * 获取所有已注册的 Manager 名称列表
   *
   * @returns Manager 名称数组
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
   * 获取所有已初始化的 Manager 名称列表
   *
   * @returns 已初始化 Manager 名称数组
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
   * 初始化指定名称的 Manager
   *
   * 此方法会:
   * 1. 检查 Manager 是否已初始化
   * 2. 检查 Manager 当前状态
   * 3. 解析并初始化依赖
   * 4. 调用 Manager 的 initialize 方法（如果存在）
   * 5. 处理重试和超时逻辑
   * 6. 更新 Manager 状态
   *
   * @param name - Manager 名称
   * @returns Promise，初始化完成后 resolve
   * @throws {ManagerInitializationError} 如果初始化失败
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
   * 获取 Manager 初始化默认配置
   *
   * @returns Manager 初始化选项
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
   * 释放 RuntimeManagerCoordinator 及其管理的所有 Manager
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
   * 初始化 Manager 的内部实现（支持依赖路径跟踪）
   *
   * @param name - Manager 名称
   * @param path - 依赖路径（用于检测循环依赖）
   * @returns Promise，初始化完成后 resolve
   * @throws {ManagerInitializationError} 如果初始化失败
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
   * 处理已存在的 Manager 状态
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
   * 验证 Manager 依赖
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
   * 运行 Manager 初始化流程
   *
   * @param manager - Manager 实例
   * @param name - Manager 名称
   * @param path - 依赖路径
   * @param dependencies - 依赖列表
   * @returns Promise，初始化完成后 resolve
   * @throws {ManagerInitializationError} 如果初始化失败
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
   * 解析 Manager 初始化配置
   *
   * @param name - Manager 名称
   * @returns 标准化的初始化配置
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
   * 调用 Manager 的 initialize 方法（支持重试）
   *
   * @param manager - Manager 实例
   * @param name - Manager 名称
   * @param path - 依赖路径
   * @param config - 初始化配置
   * @returns Promise，初始化完成后 resolve
   * @throws {ManagerInitializationError} 如果初始化失败
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
   * 封装 Manager 初始化重试逻辑，降低 invokeManagerInitialize 的复杂度
   *
   * @param initialize - 初始化函数
   * @param config - 初始化配置
   * @param name - Manager 名称
   * @param path - 依赖路径
   * @param attempts - 总尝试次数
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
   * 处理失败的初始化尝试
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
   * 执行单次初始化尝试（支持超时）
   *
   * @param task - 初始化任务
   * @param config - 初始化配置
   * @param name - Manager 名称
   * @param path - 依赖路径
   * @param attempt - 当前尝试次数
   * @param attempts - 总尝试次数
   * @returns Promise，初始化完成后 resolve
   * @throws {Error} 如果初始化超时或失败
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
   * 检查错误是否为初始化超时错误
   *
   * @param error - 错误对象
   * @returns 如果是超时错误返回 true，否则返回 false
   * @private
   */
  private isInitializationTimeoutError(error: unknown): boolean {
    return Boolean(error && typeof error === "object" && INITIALIZATION_TIMEOUT_FLAG in error);
  }

  /**
   * 标准化初始化选项
   *
   * @param options - 初始化选项
   * @returns 标准化的初始化配置
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
   * 休眠指定毫秒数
   *
   * @param delayMs - 延迟毫秒数
   * @returns Promise，延迟完成后 resolve
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
