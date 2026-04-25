/**
 * @module src/common/entity/entity-manager
 * @description Entity manager module exporting core, events, registry bridge, and render hook.
 * Provides the main components for managing entity lifecycle and operations
 */

export { EntityManagerCore } from "./core";
export type { EntityManagerCoreDependencies } from "./core";
export { EntityEventDispatcher } from "./events";
export { EntityRegistryBridge } from "./registry-bridge";
export { EntityRenderHook } from "./render-hook";
