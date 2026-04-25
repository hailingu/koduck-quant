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
  private listeners = new Map<keyof TEvents, Set<(...args: unknown[]) => void>>();

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
 * RegistryBroker 事件定义
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
 * RegistryBroker 实现
 *
 * 使用中介者模式和事件驱动架构来解耦 RegistryManager 和 EntityManager。
 * 通过事件总线协调注册表查询和管理操作，避免直接依赖。
 */
export class RegistryBroker implements IRegistryBroker {
  private eventEmitter = new LightweightEventEmitter<EventPayloadMap>();
  private registryManager?: IRegistryManager<IEntity> | undefined;
  private entityManager?: { getEntityTypeRegistry: (type: string) => unknown } | undefined;

  /**
   * 注册 RegistryManager 实例
   */
  registerRegistryManager(manager: IRegistryManager<IEntity>): void {
    this.registryManager = manager;
    this.eventEmitter.emit(RegistryBrokerEvent.RegistryManagerRegistered, manager);
  }

  /**
   * 注册 EntityManager 实例
   */
  registerEntityManager(manager: { getEntityTypeRegistry: (type: string) => unknown }): void {
    this.entityManager = manager;
    this.eventEmitter.emit(RegistryBrokerEvent.EntityManagerRegistered, manager);
  }

  /**
   * 根据实体类型获取注册表
   */
  getRegistryForType(type: string): IRegistry<IEntity> | undefined {
    // 优先使用 RegistryManager
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

    // 回退到 EntityManager（如果有的话）
    if (this.entityManager) {
      const registry = this.entityManager.getEntityTypeRegistry(type);
      return registry as IRegistry<IEntity> | undefined;
    }

    return undefined;
  }

  /**
   * 根据实体实例获取注册表
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

    // 如果没有 RegistryManager，通过实体类型回退
    return this.getRegistryForType(entity.type || entity.constructor?.name);
  }

  /**
   * 获取默认注册表
   */
  getDefaultRegistry(): IRegistry<IEntity> | undefined {
    return this.registryManager?.getDefaultRegistry();
  }

  /**
   * 检查注册表是否存在
   */
  hasRegistry(name: string): boolean {
    // 通过尝试获取注册表来检查是否存在
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
   * 获取所有注册表名称
   */
  getRegistryNames(): string[] {
    // 如果 RegistryManager 有扩展方法，使用它；否则返回空数组
    const manager = this.registryManager as IRegistryManager<IEntity> & {
      getRegistryNames?: () => string[];
    };
    return manager?.getRegistryNames?.() ?? [];
  }

  /**
   * 添加注册表
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
   * 移除注册表
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
   * 设置默认注册表
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
   * 绑定实体类型到注册表
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
   * 解除类型绑定
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
   * 获取事件发射器，用于监听 broker 事件
   */
  getEventEmitter(): LightweightEventEmitter<EventPayloadMap> {
    return this.eventEmitter;
  }

  /**
   * 订阅注册表变更事件
   */
  onRegistryChange(listener: (event: RegistryEvent) => void): () => void {
    this.eventEmitter.on("registry-change", listener);
    return () => this.eventEmitter.off("registry-change", listener);
  }

  /**
   * 订阅实体变更事件
   */
  onEntityChange(listener: (event: EntityEvent) => void): () => void {
    this.eventEmitter.on("entity-change", listener);
    return () => this.eventEmitter.off("entity-change", listener);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.eventEmitter.removeAllListeners();
    this.registryManager = undefined;
    this.entityManager = undefined;
  }
}

/**
 * 创建 RegistryBroker 实例
 */
export function createRegistryBroker(): RegistryBroker {
  return new RegistryBroker();
}
