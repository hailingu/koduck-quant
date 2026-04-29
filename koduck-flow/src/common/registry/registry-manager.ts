import { type IRegistry, type IRegistryManager, type IMeta } from "./types";
import { type IEntity } from "../entity/";
import type { IRegistryBroker } from "./broker";
import { ErrorCode, ErrorSeverity, logError } from "../errors";
import type { IDisposable } from "../disposable";
import { logger } from "../logger";

/**
 * Registry persistence interface for external storage
 */
export interface IRegistryPersistence {
  /**
   * Save all registries to external storage
   */
  save(registries: Map<string, IRegistry<IEntity>>): Promise<void>;

  /**
   * Load registries from external storage
   */
  load(): Promise<Map<string, IRegistry<IEntity>> | null>;

  /**
   * Clear persisted data
   */
  clear(): Promise<void>;
}

/**
 * 注册表管理器
 *
 * 实现 IRegistryManager 接口的注册表管理中心，负责：
 * 1. 管理多个实体注册表的生命周期
 * 2. 提供统一的注册表访问接口
 * 3. 支持动态添加和移除注册表
 *
 * 主要功能：
 * - 注册表管理：addRegistry() 添加注册表实例
 * - 查询服务：getRegistry(name) 获取指定注册表
 * - 生命周期：removeRegistry() 移除注册表
 *
 * @example
 * ```typescript
 * const manager = RegistryManager.getInstance();
 * const entityRegistry = new EntityRegistry(...);
 *
 * // 添加注册表
 * manager.addRegistry("entity", entityRegistry);
 *
 * // 获取注册表
 * const registry = manager.getRegistry<IRenderableRegistry<IEntity>>("entity");
 * ```
 */
export class RegistryManager implements IRegistryManager<IEntity>, IDisposable {
  static type = "RegistryManager";
  readonly name = "RegistryManager";
  readonly type = "registry";

  /** 注册表映射表，key: 注册表名称, value: 注册表实例 */
  private _registries: Map<string, IRegistry<IEntity>> = new Map();
  /** 当前默认注册表名称（更明确的默认指针管理） */
  private _defaultRegistryName: string | undefined;
  /** 类型绑定表：实体类型 -> 注册表名称 */
  private readonly _typeBindings: Map<string, string> = new Map();
  /** 等待注册表的实体队列 */
  private readonly _pendingEntities: Set<IEntity> = new Set();

  // Performance optimization: lookup cache for entity type -> registry
  private readonly _typeLookupCache: Map<string, IRegistry<IEntity> | null> = new Map();
  private readonly _metaTypeLookupCache: Map<string, IRegistry<IEntity> | null> = new Map();

  // Persistence support
  private _persistence?: IRegistryPersistence;
  private _initialized = false;

  /** IRegistryManager 接口要求的 meta 属性 */
  public readonly meta: IMeta = {
    type: "RegistryManager",
    description: "Koduck Flow 注册表管理器 - 统一管理多个实体注册表",
  };

  /**
   * 根据名称获取注册表（新 API）
   */
  public getRegistry(name: string): IRegistry<IEntity> | undefined {
    return this._registries.get(name);
  }

  /**
   * 明确获取默认注册表（新 API）
   */
  public getDefaultRegistry(): IRegistry<IEntity> | undefined {
    if (!this._defaultRegistryName) return undefined;
    return this._registries.get(this._defaultRegistryName);
  }

  /**
   * 添加命名注册表
   *
   * 扩展方法：支持按名称管理多个注册表实例
   */
  public addRegistry<T extends IEntity>(name: string, registry: IRegistry<T>): void {
    if (!name || typeof name !== "string") {
      logError(ErrorCode.REGISTRY_INVALID_TYPE_INFO, `Invalid registry name provided: ${name}`, {
        severity: ErrorSeverity.ERROR,
        context: {
          providedName: name,
          nameType: typeof name,
        },
      });
      return;
    }

    if (!registry) {
      logError(
        ErrorCode.REGISTRY_CONSTRUCTOR_INVALID,
        `Invalid registry provided for name "${name}"`,
        {
          severity: ErrorSeverity.ERROR,
          context: {
            registryName: name,
            registryType: typeof registry,
          },
        }
      );
      return;
    }

    // 检查是否已存在同名注册表
    if (this._registries.has(name)) {
      logError(
        ErrorCode.REGISTRY_TYPE_ALREADY_REGISTERED,
        `Registry with name "${name}" already exists`,
        {
          severity: ErrorSeverity.WARNING,
          context: {
            registryName: name,
            existingRegistry: this._registries.get(name),
            newRegistryType: registry.meta?.type || "unknown",
          },
        }
      );
      return;
    }

    try {
      this._registries.set(name, registry as IRegistry<IEntity>);

      // Clear lookup cache when registry changes
      this._clearLookupCache();

      // 新语义：不再自动设置默认注册表，需显式 setDefaultRegistry(name)

      // 检查 pending 实体并重试渲染（保持现状，不新增机制）
      this.processPendingEntities();
    } catch (error) {
      logError(ErrorCode.REGISTRY_INVALID_TYPE_INFO, `Failed to add registry "${name}"`, {
        severity: ErrorSeverity.ERROR,
        context: {
          registryName: name,
          registryMeta: registry.meta,
        },
        cause: error instanceof Error ? error : new Error(String(error)),
      });
      logger.error("Failed to add registry", { name, error });
    }
  }

  /**
   * 设置默认注册表名称
   */
  public setDefaultRegistry(name: string): void {
    if (!name || !this._registries.has(name)) {
      logError(
        ErrorCode.ENTITY_TYPE_NOT_REGISTERED,
        `Cannot set default registry: name="${name}" not found`,
        {
          severity: ErrorSeverity.WARNING,
          context: { name, available: this.getRegistryNames() },
        }
      );
      return;
    }
    this._defaultRegistryName = name;
    logger.info(`[RegistryManager] 默认注册表已设置为: ${name}`);
  }

  // 旧 API getRegistryByName 已移除

  /**
   * 处理等待的实体，当新的 registry 注册时重试渲染
   */
  private processPendingEntities(): void {
    // 导入 RenderManager 来通知重试渲染
    // 避免循环依赖，使用动态导入或延迟处理
    for (const entity of this._pendingEntities) {
      const registry = this.getRegistryForEntity(entity);
      if (registry) {
        this._pendingEntities.delete(entity);
        // 这里可以触发渲染事件或回调
        // 为了避免循环依赖，暂时只是从队列中移除
      }
    }
  }

  /**
   * 添加实体到等待队列（当找不到对应 registry 时使用）
   */
  public addPendingEntity(entity: IEntity): void {
    this._pendingEntities.add(entity);
  }

  /**
   *
   * 根据实体查找对应的 registry 实例（优化版：使用缓存避免重复遍历）
   * 查找规则（优先级）：
   * - 尝试匹配 registry.meta.type === entity.type
   * - 尝试调用 registry.canRender(entity)
   * - 尝试匹配 registry.getConstructor().name === entity.type
   * - 返回默认 registry
   */
  public getRegistryForEntity(entity: IEntity): IRegistry<IEntity> | undefined {
    if (!entity) return this.getDefaultRegistry();

    const entityType = entity.type || entity.constructor?.name;
    if (!entityType) return this.getDefaultRegistry();

    // Fast path 1: Check lookup cache first
    const cached = this._typeLookupCache.get(entityType);
    if (cached !== undefined) {
      return cached ?? this.getDefaultRegistry();
    }

    // Fast path 2: 绑定表优先：type -> registryName
    const bound = this._typeBindings.get(entityType);
    if (bound) {
      const reg = this._registries.get(bound);
      if (reg) {
        this._typeLookupCache.set(entityType, reg);
        return reg;
      }
    }

    // Fast path 3: 按注册表名称精准匹配
    const direct = this._registries.get(entityType);
    if (direct) {
      this._typeLookupCache.set(entityType, direct);
      return direct;
    }

    // Slow path: 按 meta.type 匹配（一次性构建索引）
    if (this._metaTypeLookupCache.size === 0 && this._registries.size > 0) {
      this._buildMetaTypeLookupCache();
    }

    const metaCached = this._metaTypeLookupCache.get(entityType);
    if (metaCached !== undefined) {
      this._typeLookupCache.set(entityType, metaCached);
      return metaCached ?? this.getDefaultRegistry();
    }

    // Fallback: 默认注册表
    const defaultReg = this.getDefaultRegistry();
    this._typeLookupCache.set(entityType, defaultReg ?? null);
    return defaultReg;
  }

  /**
   * 构建 meta.type 查找缓存（一次性扫描所有注册表）
   */
  private _buildMetaTypeLookupCache(): void {
    this._metaTypeLookupCache.clear();
    for (const registry of this._registries.values()) {
      const metaType = registry?.meta?.type;
      if (metaType && !this._metaTypeLookupCache.has(metaType)) {
        this._metaTypeLookupCache.set(metaType, registry);
      }

      // 同时缓存构造器名
      const ctor = (
        registry as Partial<{ getConstructor: () => { name?: string } }>
      ).getConstructor?.();
      if (ctor?.name && !this._metaTypeLookupCache.has(ctor.name)) {
        this._metaTypeLookupCache.set(ctor.name, registry);
      }
    }
  }

  /**
   * 清空查找缓存（在注册表变更时调用）
   */
  private _clearLookupCache(): void {
    this._typeLookupCache.clear();
    this._metaTypeLookupCache.clear();
  }

  public getRegistryForType(type: string): IRegistry<IEntity> | undefined {
    if (!type) return undefined;

    // Fast path 1: Check cache first
    const cached = this._typeLookupCache.get(type);
    if (cached !== undefined) {
      return cached ?? undefined;
    }

    // Fast path 2: 绑定表优先
    const bound = this._typeBindings.get(type);
    if (bound) {
      const reg = this._registries.get(bound);
      if (reg) {
        this._typeLookupCache.set(type, reg);
        return reg;
      }
    }

    // Fast path 3: 名称精准
    const direct = this._registries.get(type);
    if (direct) {
      this._typeLookupCache.set(type, direct);
      return direct;
    }

    // Slow path: meta.type 匹配（使用缓存）
    if (this._metaTypeLookupCache.size === 0 && this._registries.size > 0) {
      this._buildMetaTypeLookupCache();
    }

    const metaCached = this._metaTypeLookupCache.get(type);
    if (metaCached !== undefined) {
      this._typeLookupCache.set(type, metaCached);
      return metaCached ?? undefined;
    }

    // Fallback
    const defaultReg = this.getDefaultRegistry();
    this._typeLookupCache.set(type, defaultReg ?? null);
    return defaultReg;
  }

  /**
   * 移除指定名称的注册表
   *
   * 扩展方法：从命名注册表集合中移除指定注册表
   */
  public removeRegistry(name: string): boolean {
    if (!name || typeof name !== "string") {
      logError(
        ErrorCode.REGISTRY_INVALID_TYPE_INFO,
        `Invalid registry name provided for removal: ${name}`,
        {
          severity: ErrorSeverity.WARNING,
          context: {
            providedName: name,
            nameType: typeof name,
          },
        }
      );
      return false;
    }

    if (!this._registries.has(name)) {
      logError(ErrorCode.ENTITY_TYPE_NOT_REGISTERED, `Registry "${name}" not found for removal`, {
        severity: ErrorSeverity.WARNING,
        context: {
          name,
          availableRegistries: this.getRegistryNames(),
        },
      });
      return false;
    }
    const ok = this._registries.delete(name);
    if (ok) {
      // 若删除的是默认注册表，清空默认指针
      if (this._defaultRegistryName === name) {
        this._defaultRegistryName = undefined;
      }
      // Clear lookup cache when registry changes
      this._clearLookupCache();
      // 清理绑定到该名称的所有类型映射
      for (const [t, n] of Array.from(this._typeBindings.entries())) {
        if (n === name) this._typeBindings.delete(t);
      }
    }
    return ok;
  }

  /**
   * 绑定实体类型到指定注册表名称
   */
  public bindTypeToRegistry(type: string, name: string): void {
    if (!type || !name) return;
    if (!this._registries.has(name)) {
      logError(
        ErrorCode.ENTITY_TYPE_NOT_REGISTERED,
        `Cannot bind type "${type}" to non-existent registry "${name}"`,
        { severity: ErrorSeverity.WARNING, context: { type, name } }
      );
      return;
    }
    this._typeBindings.set(type, name);
  }

  /**
   * 解除类型与注册表的绑定
   */
  public unbindType(type: string): void {
    if (!type) return;
    this._typeBindings.delete(type);
  }

  /** 检查注册表是否存在 */
  public hasRegistry(name: string): boolean {
    return this._registries.has(name);
  }

  /** 获取所有注册表名称 */
  public getRegistryNames(): string[] {
    return Array.from(this._registries.keys());
  }

  /** 获取所有注册表实例 */
  public getAllRegistries(): IRegistry<IEntity>[] {
    return Array.from(this._registries.values());
  }

  /**
   * 获取所有注册表名称
   */
  public getAllRegistryNames(): string[] {
    return Array.from(this._registries.keys());
  }

  /** 清空所有注册表引用 */
  public clearRegistries(): void {
    this._registries.clear();
    this._clearLookupCache();
    logger.warn("Registries cleared");
  }

  /** 获取注册表数量 */
  public getRegistryCount(): number {
    return this._registries.size;
  }

  /** 获取注册表条目 */
  public getRegistryEntries(): [string, IRegistry<IEntity>][] {
    return Array.from(this._registries.entries());
  }

  /**
   * Set persistence adapter for external storage
   */
  public setPersistence(persistence: IRegistryPersistence): void {
    this._persistence = persistence;
  }

  /**
   * Initialize registries from external storage (if persistence is configured)
   */
  public async initialize(): Promise<void> {
    if (this._initialized) {
      logger.warn("RegistryManager already initialized");
      return;
    }

    if (this._persistence) {
      try {
        const loaded = await this._persistence.load();
        if (loaded) {
          this._registries = loaded;
          this._clearLookupCache();
          logger.info(`Loaded ${loaded.size} registries from persistence`);
        }
      } catch (error) {
        logger.error("Failed to load registries from persistence:", error);
      }
    }

    this._initialized = true;
  }

  /**
   * Save current registries to external storage (if persistence is configured)
   */
  public async save(): Promise<void> {
    if (!this._persistence) {
      logger.warn("No persistence configured, skipping save");
      return;
    }

    try {
      await this._persistence.save(this._registries);
      logger.info(`Saved ${this._registries.size} registries to persistence`);
    } catch (error) {
      logger.error("Failed to save registries:", error);
      throw error;
    }
  }

  /**
   * Restore registries from persistence (manual trigger)
   */
  public async restore(): Promise<boolean> {
    if (!this._persistence) {
      logger.warn("No persistence configured");
      return false;
    }

    try {
      const loaded = await this._persistence.load();
      if (loaded) {
        this._registries = loaded;
        this._clearLookupCache();
        logger.info(`Restored ${loaded.size} registries from persistence`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Failed to restore registries:", error);
      return false;
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    logger.debug("RegistryManager disposed");

    // Save to persistence if configured (before clearing)
    if (this._persistence && this._registries.size > 0) {
      this.save().catch((error) => {
        logger.error("Failed to save registries on dispose:", error);
      });
    }

    this._registries.clear();
    this._defaultRegistryName = undefined;
    this._pendingEntities.clear();
    this._typeBindings.clear();
    this._clearLookupCache();
  }
}

export interface RegistryManagerDependencies {
  registryBroker?: IRegistryBroker;
}

export function createRegistryManager(dependencies?: RegistryManagerDependencies): RegistryManager {
  const manager = new RegistryManager();

  dependencies?.registryBroker?.registerRegistryManager(manager);

  return manager;
}
