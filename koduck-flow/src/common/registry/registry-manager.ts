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
 * Registry manager
 *
 * Registry management center implementing the IRegistryManager interface, responsible for:
 * 1. Managing the lifecycle of multiple entity registries
 * 2. Providing unified registry access interface
 * 3. Supporting dynamic addition and removal of registries
 *
 * Main features:
 * - Registry management: addRegistry() to add registry instances
 * - Query service: getRegistry(name) to get specified registry
 * - Lifecycle: removeRegistry() to remove registries
 *
 * @example
 * ```typescript
 * const manager = RegistryManager.getInstance();
 * const entityRegistry = new EntityRegistry(...);
 *
 * // Add registry
 * manager.addRegistry("entity", entityRegistry);
 *
 * // Get registry
 * const registry = manager.getRegistry<IRenderableRegistry<IEntity>>("entity");
 * ```
 */
export class RegistryManager implements IRegistryManager<IEntity>, IDisposable {
  static type = "RegistryManager";
  readonly name = "RegistryManager";
  readonly type = "registry";

  /** Registry mapping table, key: registry name, value: registry instance */
  private _registries: Map<string, IRegistry<IEntity>> = new Map();
  /** Current default registry name (more explicit default pointer management) */
  private _defaultRegistryName: string | undefined;
  /** Type binding table: entity type -> registry name */
  private readonly _typeBindings: Map<string, string> = new Map();
  /** Entity queue waiting for registry */
  private readonly _pendingEntities: Set<IEntity> = new Set();

  // Performance optimization: lookup cache for entity type -> registry
  private readonly _typeLookupCache: Map<string, IRegistry<IEntity> | null> = new Map();
  private readonly _metaTypeLookupCache: Map<string, IRegistry<IEntity> | null> = new Map();

  // Persistence support
  private _persistence?: IRegistryPersistence;
  private _initialized = false;

  /** Meta property required by IRegistryManager interface */
  public readonly meta: IMeta = {
    type: "RegistryManager",
    description: "Koduck Flow registry manager - unified management of multiple entity registries",
  };

  /**
   * Get registry by name (new API)
   */
  public getRegistry(name: string): IRegistry<IEntity> | undefined {
    return this._registries.get(name);
  }

  /**
   * Explicitly get default registry (new API)
   */
  public getDefaultRegistry(): IRegistry<IEntity> | undefined {
    if (!this._defaultRegistryName) return undefined;
    return this._registries.get(this._defaultRegistryName);
  }

  /**
   * Add named registry
   *
   * Extension method: supports managing multiple registry instances by name
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

    // Check if a registry with the same name already exists
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

      // New semantics: no longer auto-set default registry, need explicit setDefaultRegistry(name)

      // Check pending entities and retry rendering (keep current state, no new mechanism)
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
   * Set default registry name
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
    logger.info(`[RegistryManager] Default registry set to: ${name}`);
  }

  // Old API getRegistryByName removed

  /**
   * Process pending entities, retry rendering when new registry is registered
   */
  private processPendingEntities(): void {
    // Import RenderManager to notify retry rendering
    // Avoid circular dependency, use dynamic import or deferred processing
    for (const entity of this._pendingEntities) {
      const registry = this.getRegistryForEntity(entity);
      if (registry) {
        this._pendingEntities.delete(entity);
        // Can trigger render events or callbacks here
        // To avoid circular dependency, temporarily just remove from queue
      }
    }
  }

  /**
   * Add entity to pending queue (used when corresponding registry is not found)
   */
  public addPendingEntity(entity: IEntity): void {
    this._pendingEntities.add(entity);
  }

  /**
   *
   * Find corresponding registry instance by entity (optimized: use cache to avoid repeated traversal)
   * Lookup rules (priority):
   * - Try matching registry.meta.type === entity.type
   * - Try calling registry.canRender(entity)
   * - Try matching registry.getConstructor().name === entity.type
   * - Return default registry
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

    // Fast path 2: binding table first: type -> registryName
    const bound = this._typeBindings.get(entityType);
    if (bound) {
      const reg = this._registries.get(bound);
      if (reg) {
        this._typeLookupCache.set(entityType, reg);
        return reg;
      }
    }

    // Fast path 3: exact match by registry name
    const direct = this._registries.get(entityType);
    if (direct) {
      this._typeLookupCache.set(entityType, direct);
      return direct;
    }

    // Slow path: match by meta.type (build index once)
    if (this._metaTypeLookupCache.size === 0 && this._registries.size > 0) {
      this._buildMetaTypeLookupCache();
    }

    const metaCached = this._metaTypeLookupCache.get(entityType);
    if (metaCached !== undefined) {
      this._typeLookupCache.set(entityType, metaCached);
      return metaCached ?? this.getDefaultRegistry();
    }

    // Fallback: default registry
    const defaultReg = this.getDefaultRegistry();
    this._typeLookupCache.set(entityType, defaultReg ?? null);
    return defaultReg;
  }

  /**
   * Build meta.type lookup cache (scan all registries once)
   */
  private _buildMetaTypeLookupCache(): void {
    this._metaTypeLookupCache.clear();
    for (const registry of this._registries.values()) {
      const metaType = registry?.meta?.type;
      if (metaType && !this._metaTypeLookupCache.has(metaType)) {
        this._metaTypeLookupCache.set(metaType, registry);
      }

      // Also cache constructor name
      const ctor = (
        registry as Partial<{ getConstructor: () => { name?: string } }>
      ).getConstructor?.();
      if (ctor?.name && !this._metaTypeLookupCache.has(ctor.name)) {
        this._metaTypeLookupCache.set(ctor.name, registry);
      }
    }
  }

  /**
   * Clear lookup cache (called when registry changes)
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

    // Fast path 2: binding table first
    const bound = this._typeBindings.get(type);
    if (bound) {
      const reg = this._registries.get(bound);
      if (reg) {
        this._typeLookupCache.set(type, reg);
        return reg;
      }
    }

    // Fast path 3: exact name match
    const direct = this._registries.get(type);
    if (direct) {
      this._typeLookupCache.set(type, direct);
      return direct;
    }

    // Slow path: meta.type match (using cache)
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
   * Remove registry by specified name
   *
   * Extension method: remove specified registry from named registry collection
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
      // If deleted registry is the default, clear default pointer
      if (this._defaultRegistryName === name) {
        this._defaultRegistryName = undefined;
      }
      // Clear lookup cache when registry changes
      this._clearLookupCache();
      // Clean up all type mappings bound to this name
      for (const [t, n] of Array.from(this._typeBindings.entries())) {
        if (n === name) this._typeBindings.delete(t);
      }
    }
    return ok;
  }

  /**
   * Bind entity type to specified registry name
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
   * Unbind type from registry
   */
  public unbindType(type: string): void {
    if (!type) return;
    this._typeBindings.delete(type);
  }

  /** Check if registry exists */
  public hasRegistry(name: string): boolean {
    return this._registries.has(name);
  }

  /** Get all registry names */
  public getRegistryNames(): string[] {
    return Array.from(this._registries.keys());
  }

  /** Get all registry instances */
  public getAllRegistries(): IRegistry<IEntity>[] {
    return Array.from(this._registries.values());
  }

  /**
   * Get all registry names
   */
  public getAllRegistryNames(): string[] {
    return Array.from(this._registries.keys());
  }

  /** Clear all registry references */
  public clearRegistries(): void {
    this._registries.clear();
    this._clearLookupCache();
    logger.warn("Registries cleared");
  }

  /** Get registry count */
  public getRegistryCount(): number {
    return this._registries.size;
  }

  /** Get registry entries */
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
   * Clean up resources
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
