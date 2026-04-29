/**
 * Global API - Duck-flow unified interface
 *
 * Global API entry for Duck-flow, aggregating capabilities from all domain modules and providing a unified experience.
 * Provides common methods for entity management, flow control, rendering, and manager operations, as well as runtime configuration utilities.
 */

export * from "./api/runtime";
export * from "./api/entity";
export * from "./api/render";
export * from "./api/manager";
export * from "./api/flow";

// Re-export global runtime functions
export {
  getGlobalRuntime,
  setGlobalRuntime,
  resetGlobalRuntime,
  disposeGlobalRuntime,
  type SetGlobalRuntimeOptions,
  type ResetGlobalRuntimeOptions,
  type DisposeGlobalRuntimeOptions,
} from "./global-runtime";

export type { Entity, EntityArguments } from "./entity/entity";
export type { IEntity, IEntityArguments } from "./entity/types";
