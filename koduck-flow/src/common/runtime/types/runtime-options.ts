/**
 * KoduckFlowRuntime configuration options type definitions
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
 * KoduckFlowRuntime construction options
 */
export interface KoduckFlowRuntimeOptions {
  /**
   * Custom DI container (optional, defaults to creating a new container)
   */
  container?: IDependencyContainer;

  /**
   * Core service override configuration
   */
  overrides?: CoreServiceOverrides;

  /**
   * Manager initialization configuration
   */
  managerInitialization?: ManagerInitializationOptions;
}

/**
 * Core Manager collection
 */
export interface CoreManagers {
  /** Entity manager */
  entity: EntityManager;
  /** Render manager */
  render: RenderManager;
  /** Registry manager */
  registry: RegistryManager;
  /** Event bus */
  eventBus: EventBus;
  /** Render event manager */
  renderEvents: RenderEventManager;
  /** Entity event manager */
  entityEvents: EntityEventManager<IEntity>;
}

/**
 * Tenant entity quota key (internal use)
 */
export const TENANT_ENTITY_QUOTA_KEY = "__entities__";
