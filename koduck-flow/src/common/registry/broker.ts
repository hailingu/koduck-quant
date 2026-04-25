import type { IEntity } from "../entity/types";
import type { IRegistryManager, IRegistry } from "./types";

/**
 * RegistryBroker 接口
 *
 * 中介者模式接口，用于解耦 RegistryManager 和 EntityManager 之间的直接依赖。
 * 通过事件驱动的方式协调注册表查询和管理操作。
 */
export interface IRegistryBroker {
  /**
   * 注册 RegistryManager 实例
   * @param manager RegistryManager 实例
   */
  registerRegistryManager(manager: IRegistryManager<IEntity>): void;

  /**
   * 注册 EntityManager 实例
   * @param manager EntityManager 实例（通过回调方式避免循环依赖）
   */
  registerEntityManager(manager: { getEntityTypeRegistry: (type: string) => unknown }): void;

  /**
   * 根据实体类型获取注册表
   * @param type 实体类型
   * @returns 对应的注册表实例
   */
  getRegistryForType(type: string): IRegistry<IEntity> | undefined;

  /**
   * 根据实体实例获取注册表
   * @param entity 实体实例
   * @returns 对应的注册表实例
   */
  getRegistryForEntity(entity: IEntity): IRegistry<IEntity> | undefined;

  /**
   * 获取默认注册表
   * @returns 默认注册表实例
   */
  getDefaultRegistry(): IRegistry<IEntity> | undefined;

  /**
   * 检查注册表是否存在
   * @param name 注册表名称
   * @returns 是否存在
   */
  hasRegistry(name: string): boolean;

  /**
   * 获取所有注册表名称
   * @returns 注册表名称数组
   */
  getRegistryNames(): string[];

  /**
   * 添加注册表
   * @param name 注册表名称
   * @param registry 注册表实例
   */
  addRegistry(name: string, registry: IRegistry<IEntity>): void;

  /**
   * 移除注册表
   * @param name 注册表名称
   * @returns 是否成功移除
   */
  removeRegistry(name: string): boolean;

  /**
   * 设置默认注册表
   * @param name 注册表名称
   */
  setDefaultRegistry(name: string): void;

  /**
   * 绑定实体类型到注册表
   * @param type 实体类型
   * @param name 注册表名称
   */
  bindTypeToRegistry(type: string, name: string): void;

  /**
   * 解除类型绑定
   * @param type 实体类型
   */
  unbindType(type: string): void;

  /**
   * 订阅注册表变更事件
   * @param listener 事件监听器
   * @returns 取消订阅函数
   */
  onRegistryChange(listener: (event: RegistryEvent) => void): () => void;

  /**
   * 订阅实体变更事件
   * @param listener 事件监听器
   * @returns 取消订阅函数
   */
  onEntityChange(listener: (event: EntityEvent) => void): () => void;

  /**
   * 清理资源
   */
  dispose(): void;
}

/**
 * 注册表事件类型
 */
export type RegistryEvent =
  | { type: "REGISTRY_ADDED"; payload: { name: string; registry: IRegistry<IEntity> } }
  | { type: "REGISTRY_REMOVED"; payload: { name: string } }
  | { type: "REGISTRY_UPDATED"; payload: { name: string; registry: IRegistry<IEntity> } }
  | { type: "DEFAULT_REGISTRY_CHANGED"; payload: { name: string } }
  | { type: "TYPE_BOUND"; payload: { type: string; registryName: string } }
  | { type: "TYPE_UNBOUND"; payload: { type: string } };

/**
 * 实体事件类型
 */
export type EntityEvent =
  | { type: "ENTITY_CREATED"; payload: { id: string; type: string; entity: IEntity } }
  | { type: "ENTITY_UPDATED"; payload: { id: string; changes: Partial<IEntity> } }
  | { type: "ENTITY_REMOVED"; payload: { id: string } };
