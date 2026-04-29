import type { IEntity } from "../entity";
import type { IRegistryManager, IRegistry } from "./types";
type EventPayloadMap = {
  [RegistryBrokerEvent.RegistryManagerRegistered]: [IRegistryManager<IEntity>];
  [RegistryBrokerEvent.EntityManagerRegistered]: [
    { getEntityTypeRegistry: (type: string) => unknown },
  ];
  "registry-change": [RegistryEvent];
  "entity-change": [EntityEvent];
};

class LightweightEventEmitter<TEvents extends Record<string, unknown[]>> {
  private readonly listeners = new Map<keyof TEvents, Set<(...args: unknown[]) => void>>();

  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void {
    const existing = this.listeners.get(event);
    if (existing) {
      existing.add(listener as (...args: unknown[]) => void);
    } else {
      this.listeners.set(event, new Set([listener as (...args: unknown[]) => void]));
    }
  }

  off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void {
    const existing = this.listeners.get(event);
    if (!existing) {
      return;
    }
    existing.delete(listener as (...args: unknown[]) => void);
    if (existing.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    for (const listener of handlers) {
      (listener as (...listenerArgs: TEvents[K]) => void)(...args);
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
import type { IRegistryBroker, RegistryEvent, EntityEvent } from "./broker";
import { ensureAutoRegistry } from "../../utils/decorator/auto-registry";
import { RegistryManager } from "./registry-manager";

/**
 * RegistryBroker event definitions
 */
export const RegistryBrokerEvent = {
  RegistryManagerRegistered: "registry-broker:registry-manager-registered",
  EntityManagerRegistered: "registry-broker:entity-manager-registered",
  RegistryAdded: "registry-broker:registry-added",
  RegistryRemoved: "registry-broker:registry-removed",
  DefaultRegistryChanged: "registry-broker:default-registry-changed",
  TypeBound: "registry-broker:type-bound",
  TypeUnbound: "registry-broker:type-unbound",
} as const;

/**
 * RegistryBroker implementation
 *
 * Uses the Mediator pattern and event-driven architecture to decouple RegistryManager and EntityManager.
 * Coordinates registry queries and management operations via the event bus to avoid direct dependencies.
 */
export class RegistryBroker implements IRegistryBroker {
  private readonly eventEmitter = new LightweightEventEmitter<EventPayloadMap>();
  private registryManager?: IRegistryManager<IEntity> | undefined;
  private entityManager?: { getEntityTypeRegistry: (type: string) => unknown } | undefined;

  /**
   * Register RegistryManager instance
   */
  registerRegistryManager(manager: IRegistryManager<IEntity>): void {
    this.registryManager = manager;
    this.eventEmitter.emit(RegistryBrokerEvent.RegistryManagerRegistered, manager);
  }

  /**
   * Register EntityManager instance
   */
  registerEntityManager(manager: { getEntityTypeRegistry: (type: string) => unknown }): void {
    this.entityManager = manager;
    this.eventEmitter.emit(RegistryBrokerEvent.EntityManagerRegistered, manager);
  }

  /**
   * Get registry by entity type
   */
  getRegistryForType(type: string): IRegistry<IEntity> | undefined {
    // Prefer using RegistryManager
    if (this.registryManager) {
      const registry = this.registryManager.getRegistryForType(type);
      if (registry) {
        return registry;
      }

      if (this.registryManager instanceof RegistryManager) {
        const restored = ensureAutoRegistry(type, this.registryManager);
        if (restored) {
          return this.registryManager.getRegistryForType(type);
        }
      }
    }

    // Fallback to EntityManager (if available)
    if (this.entityManager) {
      const registry = this.entityManager.getEntityTypeRegistry(type);
      return registry as IRegistry<IEntity> | undefined;
    }

    return undefined;
  }

  /**
   * Get registry by entity instance
   */
  getRegistryForEntity(entity: IEntity): IRegistry<IEntity> | undefined {
    if (this.registryManager) {
      const registry = this.registryManager.getRegistryForEntity(entity);
      if (registry) {
        return registry;
      }

      if (this.registryManager instanceof RegistryManager) {
        const type = entity.type || entity.constructor?.name;
        if (type && ensureAutoRegistry(type, this.registryManager)) {
          return this.registryManager.getRegistryForEntity(entity);
        }
      }
    }

    // If no RegistryManager, fallback via entity type
    return this.getRegistryForType(entity.type || entity.constructor?.name);
  }

  /**
   * Get default registry
   */
  getDefaultRegistry(): IRegistry<IEntity> | undefined {
    return this.registryManager?.getDefaultRegistry();
  }

  /**
   * Check if registry exists
   */
  hasRegistry(name: string): boolean {
    // Check existence by attempting to get the registry
    if (!this.registryManager) {
      return false;
    }

    const existing = this.registryManager.getRegistry(name);
    if (existing) {
      return true;
    }

    if (
      this.registryManager instanceof RegistryManager &&
      ensureAutoRegistry(name, this.registryManager)
    ) {
      return this.registryManager.getRegistry(name) !== undefined;
    }

    return false;
  }

  /**
   * Get all registry names
   */
  getRegistryNames(): string[] {
    // If RegistryManager has an extended method, use it; otherwise return an empty array
    const manager = this.registryManager as IRegistryManager<IEntity> & {
      getRegistryNames?: () => string[];
    };
    return manager?.getRegistryNames?.() ?? [];
  }

  /**
   * Add registry
   */
  addRegistry(name: string, registry: IRegistry<IEntity>): void {
    if (this.registryManager) {
      this.registryManager.addRegistry(name, registry);
      this.eventEmitter.emit("registry-change", {
        type: "REGISTRY_ADDED",
        payload: { name, registry },
      } as RegistryEvent);
    }
  }

  /**
   * Remove registry
   */
  removeRegistry(name: string): boolean {
    if (this.registryManager) {
      const result = this.registryManager.removeRegistry?.(name) ?? false;
      if (result) {
        this.eventEmitter.emit("registry-change", {
          type: "REGISTRY_REMOVED",
          payload: { name },
        } as RegistryEvent);
      }
      return result;
    }
    return false;
  }

  /**
   * Set default registry
   */
  setDefaultRegistry(name: string): void {
    if (this.registryManager) {
      this.registryManager.setDefaultRegistry(name);
      this.eventEmitter.emit("registry-change", {
        type: "DEFAULT_REGISTRY_CHANGED",
        payload: { name },
      } as RegistryEvent);
    }
  }

  /**
   * Bind entity type to registry
   */
  bindTypeToRegistry(type: string, name: string): void {
    if (this.registryManager?.bindTypeToRegistry) {
      this.registryManager.bindTypeToRegistry(type, name);
      this.eventEmitter.emit("registry-change", {
        type: "TYPE_BOUND",
        payload: { type, registryName: name },
      } as RegistryEvent);
    }
  }

  /**
   * Unbind type
   */
  unbindType(type: string): void {
    if (this.registryManager?.unbindType) {
      this.registryManager.unbindType(type);
      this.eventEmitter.emit("registry-change", {
        type: "TYPE_UNBOUND",
        payload: { type },
      } as RegistryEvent);
    }
  }

  /**
   * Get event emitter for listening to broker events
   */
  getEventEmitter(): LightweightEventEmitter<EventPayloadMap> {
    return this.eventEmitter;
  }

  /**
   * Subscribe to registry change events
   */
  onRegistryChange(listener: (event: RegistryEvent) => void): () => void {
    this.eventEmitter.on("registry-change", listener);
    return () => this.eventEmitter.off("registry-change", listener);
  }

  /**
   * Subscribe to entity change events
   */
  onEntityChange(listener: (event: EntityEvent) => void): () => void {
    this.eventEmitter.on("entity-change", listener);
    return () => this.eventEmitter.off("entity-change", listener);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.eventEmitter.removeAllListeners();
    this.registryManager = undefined;
    this.entityManager = undefined;
  }
}

/**
 * Create a RegistryBroker instance
 */
export function createRegistryBroker(): RegistryBroker {
  return new RegistryBroker();
}
