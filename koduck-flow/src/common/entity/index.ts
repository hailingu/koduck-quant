/**
 * @module src/common/entity
 * @description Entity system barrel module. Exports entity types, implementations,
 * managers, and registries for entity lifecycle management
 */

// Export entity-related interfaces and types
export type {
  IEntityConstructor,
  IEntityArguments,
  IEntity,
  IRenderableEntity,
  IRenderableEntityArguments,
} from "./types";

export { Entity, type EntityArguments } from "./entity";

// Export renderable entity implementation
// export { RenderableEntity } from "./renderable-entity";

// Export entity management classes
export { EntityManager, createEntityManager } from "./entity-manager";

export { EntityRegistry } from "./entity-registry";

// Export renderable entity registry
// export { RenderableEntityRegistry } from "./renderable-entity-registry";

// Export data class
export { Data } from "../data";
