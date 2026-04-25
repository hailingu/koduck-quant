/**
 * DuckFlowRuntime 配置选项类型定义
 * @module runtime/types/runtime-options
 */

import type { IDependencyContainer } from "../../di/types";
import type { CoreServiceOverrides } from "../../di/bootstrap";
import type { EntityManager } from "../../entity/entity-manager";
import type { RenderManager } from "../../render/render-manager";
import type { RegistryManager } from "../../registry/registry-manager";
import type { EventBus } from "../../event/event-bus";
import type { RenderEventManager } from "../../event/render-event-manager";
import type { EntityEventManager } from "../../event/entity-event-manager";
import type { IEntity } from "../../entity/";
import type { ManagerInitializationOptions } from "./manager-initialization";

/**
 * DuckFlowRuntime 构造选项
 */
export interface DuckFlowRuntimeOptions {
  /**
   * 自定义 DI 容器（可选，默认创建新容器）
   */
  container?: IDependencyContainer;

  /**
   * 核心服务覆盖配置
   */
  overrides?: CoreServiceOverrides;

  /**
   * Manager 初始化配置
   */
  managerInitialization?: ManagerInitializationOptions;
}

/**
 * 核心 Manager 集合
 */
export interface CoreManagers {
  /** 实体管理器 */
  entity: EntityManager;
  /** 渲染管理器 */
  render: RenderManager;
  /** 注册表管理器 */
  registry: RegistryManager;
  /** 事件总线 */
  eventBus: EventBus;
  /** 渲染事件管理器 */
  renderEvents: RenderEventManager;
  /** 实体事件管理器 */
  entityEvents: EntityEventManager<IEntity>;
}

/**
 * 租户实体配额键名（内部使用）
 */
export const TENANT_ENTITY_QUOTA_KEY = "__entities__";
