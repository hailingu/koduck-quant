/**
 * Render convenience API for entity rendering pipeline integration.
 *
 * Exposes helpers for enqueueing entities into the render pipeline and for
 * interacting with the active `RenderManager`. The functions rely on the
 * runtime proxy as well as the manager and entity facade modules, which
 * means a `KoduckFlowRuntime` must be active before usage. React-based return
 * types are surfaced when rendering to JSX-compatible targets.
 *
 * The Render API provides two levels of functionality:
 * 1. Basic rendering operations: add, remove, and retrieve render elements
 * 2. Advanced rendering: multi-renderer support (React, Canvas, SVG, WebGL, WebGPU) and batch operations
 *
 * Usage example:
 * ```typescript
 * import { createAndRender, getRenderElement, renderWithRenderer } from './render';
 *
 * // Create and automatically add entity to render pipeline
 * const entity = createAndRender('MyComponent', { name: 'Test' });
 *
 * // Get rendered element from the render pipeline
 * const element = getRenderElement(entity.id);
 *
 * // Render with specific renderer
 * const canvas = await renderWithRenderer(entity, 'canvas');
 * ```
 *
 * @module render
 * @see {@link ./flow | Flow API}
 * @see {@link ./entity | Entity API}
 * @see {@link ./manager | Manager API}
 */
import React from "react";
import type { IEntity, IEntityArguments } from "../entity";
import { runtime } from "./runtime-context";
import { createEntity, removeEntity } from "./entity";
import { getManager } from "./manager";

/**
 * Adds an entity to the render pipeline.
 *
 * Enqueues the entity for rendering in the active `RenderManager`. The entity will be
 * processed according to its configuration and the current rendering context. This operation
 * is non-blocking and the actual rendering happens asynchronously.
 *
 * @param {IEntity} entity - The entity to add to the render pipeline.
 * @returns {void}
 *
 * Note: Entity must have a valid `id` and be properly initialized before adding to render.
 *
 * Usage example:
 * ```typescript
 * import { addToRender } from './render';
 * import { createEntity } from './entity';
 *
 * const entity = createEntity('MyComponent');
 * if (entity) {
 * addToRender(entity);
 * }
 * ```
 *
 * @see {@link removeFromRender | removeFromRender} for removal
 * @see {@link createAndRender | createAndRender} for combined creation and rendering
 */
export function addToRender(entity: IEntity): void {
  runtime.addEntityToRender(entity);
}

/**
 * Removes an entity from the render pipeline.
 *
 * Dequeues the entity from the `RenderManager` and stops its rendering. The entity itself
 * is not deleted from the system, only removed from the render queue. The entity ID must
 * correspond to an entity currently being rendered.
 *
 * @param {string} entityId - The unique identifier of the entity to remove from rendering.
 * @returns {void}
 *
 * Note: Removing a non-existent entity ID will be silently ignored.
 *
 * Usage example:
 * ```typescript
 * import { removeFromRender } from './render';
 *
 * removeFromRender('entity-uuid-here');
 * ```
 *
 * @see {@link addToRender | addToRender} for adding to render
 * @see {@link removeAndStopRender | removeAndStopRender} for combined removal and deletion
 */
export function removeFromRender(entityId: string): void {
  runtime.removeEntityFromRender(entityId);
}

/**
 * Retrieves the render element for an entity from the pipeline.
 *
 * Fetches the current rendered output for an entity in the `RenderManager`. The return type
 * depends on the active rendering context: React elements for JSX targets, strings for DOM,
 * or promises for asynchronous renderers (Canvas, SVG, WebGL, WebGPU).
 *
 * @param {string} entityId - The unique identifier of the entity to retrieve render output for.
 * @returns {React.ReactElement | string | null | void | Promise<unknown>}
 * React.ReactElement for JSX targets, string for DOM, Promise for async renderers,
 * null or void when entity is not found or not yet rendered.
 *
 * Note: The render element may be undefined if the entity is still processing or the
 * render pipeline hasn't been executed yet.
 *
 * Usage example:
 * ```typescript
 * import { getRenderElement } from './render';
 * import React from 'react';
 *
 * const element = getRenderElement('entity-id');
 *
 * if (React.isValidElement(element)) {
 * // React element - can be used in JSX
 * } else if (typeof element === 'string') {
 * // String representation
 * } else if (element instanceof Promise) {
 * const result = await element;
 * }
 * ```
 *
 * @see {@link addToRender | addToRender} for adding entities to render
 * @see {@link renderWithRenderer | renderWithRenderer} for explicit renderer selection
 */
export function getRenderElement(
  entityId: string
): React.ReactElement | string | null | void | Promise<unknown> {
  return runtime.getEntityRenderElement(entityId);
}

/**
 * Creates an entity and automatically adds it to the render pipeline.
 *
 * This is a convenience function that combines entity creation with rendering in a single call.
 * The entity is created with the provided type name and arguments, then immediately added to
 * the render queue if creation is successful.
 *
 * @template {IEntity} T - The entity type to create (defaults to IEntity).
 * @param {string} typeName - The type name of the entity to create.
 * @param {IEntityArguments} [args] - Optional arguments to pass to the entity constructor.
 * @returns {T | null} The created and enqueued entity (extends IEntity), or null if entity creation failed.
 *
 * Note: If entity creation fails, rendering is not attempted and null is returned.
 *
 * Usage example:
 * ```typescript
 * import { createAndRender } from './render';
 *
 * const component = createAndRender('TextBox', {
 * text: 'Hello, World!',
 * style: { color: 'blue' }
 * });
 *
 * if (component) {
 * console.log('Component ID:', component.id);
 * } else {
 * console.log('Failed to create component');
 * }
 *
 * interface MyComponent extends IEntity {
 * readonly text: string;
 * }
 *
 * const typed = createAndRender<MyComponent>('TextBox', { text: 'Hello' });
 * if (typed) {
 * console.log(typed.text);
 * }
 * ```
 *
 * @see {@link createEntity | createEntity} in entity API for entity creation details
 * @see {@link addToRender | addToRender} for manual rendering
 */
export function createAndRender<T extends IEntity = IEntity>(
  typeName: string,
  args?: IEntityArguments
): T | null {
  const entity = createEntity<T>(typeName, args);
  if (entity) {
    addToRender(entity);
  }
  return entity;
}

/**
 * Removes an entity from rendering and deletes it from the system.
 *
 * This is a convenience function that combines removal from the render pipeline with
 * complete entity deletion. Use this when you want to both stop rendering and remove
 * the entity entirely from the system.
 *
 * @param {string} id - The unique identifier of the entity to remove and stop rendering.
 * @returns {boolean} true if entity was successfully removed, false if entity was not found or removal failed.
 *
 * Note: This operation is permanent and cannot be undone.
 *
 * Usage example:
 * ```typescript
 * import { removeAndStopRender } from './render';
 *
 * const success = removeAndStopRender('entity-id');
 *
 * if (success) {
 * console.log('Entity removed and deleted');
 * } else {
 * console.log('Entity not found');
 * }
 * ```
 *
 * @see {@link removeFromRender | removeFromRender} for render-only removal
 * @see {@link removeEntity | removeEntity} in entity API for entity deletion
 */
export function removeAndStopRender(id: string): boolean {
  removeFromRender(id);
  return removeEntity(id);
}

/**
 * Renders an entity using a specific renderer type.
 *
 * Renders an entity with the specified renderer (React, Canvas, SVG, WebGL, or WebGPU).
 * This function sets the default renderer if needed, then delegates to the `RenderManager`
 * for the actual rendering operation. The rendering is performed asynchronously with error handling.
 *
 * @param {IEntity} entity - The entity to render.
 * @param {string} rendererType - The type of renderer: "react", "canvas", "svg", "webgl", or "webgpu".
 * @param {Record<string, unknown>} [context] - Optional rendering context with custom configuration.
 * @returns {Promise<React.ReactElement | null | void>}
 * Promise resolving to React.ReactElement (for React), null on failure, or void for non-React renderers.
 *
 * Note: Errors during rendering are caught and logged; the promise always resolves.
 *
 * Usage example:
 * ```typescript
 * import { renderWithRenderer, createEntity } from './render';
 *
 * const entity = createEntity('MyComponent');
 * if (entity) {
 * const canvas = await renderWithRenderer(entity, 'canvas', { width: 800, height: 600 });
 * const reactElement = await renderWithRenderer(entity, 'react');
 * const webglResult = await renderWithRenderer(entity, 'webgl', { shader: 'custom-vertex-shader' });
 * }
 * ```
 *
 * @see {@link batchRender | batchRender} for rendering multiple entities
 * @see {@link getRenderElement | getRenderElement} for retrieving already-rendered elements
 */
export async function renderWithRenderer(
  entity: IEntity,
  rendererType: "react" | "canvas" | "svg" | "webgl" | "webgpu",
  context?: Record<string, unknown>
): Promise<React.ReactElement | null | void> {
  try {
    const renderManager = getManager("render");
    if (!renderManager) {
      throw new Error("RenderManager not available");
    }

    const renderManagerObj = renderManager as Record<string, unknown>;

    if (typeof renderManagerObj.setDefaultRenderer === "function") {
      const setRendererMethod = renderManagerObj.setDefaultRenderer as (type: string) => void;
      setRendererMethod(rendererType);
    }

    if (typeof renderManagerObj.render === "function") {
      const renderMethod = renderManagerObj.render as (
        entity: IEntity,
        context?: Record<string, unknown>
      ) => Promise<React.ReactElement | null | void>;
      return await renderMethod(entity, context);
    }

    throw new Error("RenderManager does not support render method");
  } catch (error) {
    console.error(`Failed to render entity ${entity.id} with ${rendererType}:`, error);
    return null;
  }
}

/**
 * Renders multiple entities in batch.
 *
 * Renders a collection of entities either using the `RenderManager`'s native batch rendering
 * capability (if available) or by rendering each entity sequentially using the React renderer.
 * Batch rendering is optimized for performance when rendering multiple entities simultaneously.
 * The operation is performed asynchronously with comprehensive error handling.
 *
 * @param {IEntity[]} entities - Array of entities to render.
 * @param {Record<string, unknown>} [context] - Optional rendering context shared across all entities.
 * @returns {Promise<(React.ReactElement | null | void)[]>}
 * Promise resolving to an array of render results matching input entities in order.
 * If batch rendering fails, returns an empty array.
 *
 * Note: Individual rendering errors within the batch are logged but don't stop the operation.
 *
 * Performance Considerations:
 * - If RenderManager supports batch rendering, all entities render together
 * - Otherwise, entities render sequentially (slower for large batches)
 * - Context is shared across all renderings in the batch
 *
 * Usage example:
 * ```typescript
 * import { batchRender, createEntity } from './render';
 *
 * const entities = [
 * createEntity('TextBox', { text: 'Item 1' }),
 * createEntity('TextBox', { text: 'Item 2' }),
 * createEntity('TextBox', { text: 'Item 3' })
 * ].filter(Boolean) as IEntity[];
 *
 * const results = await batchRender(entities, { theme: 'dark', fontSize: 14 });
 *
 * results.forEach((result, index) => {
 * if (result) {
 * console.log(`Entity ${index} rendered successfully`);
 * } else {
 * console.log(`Entity ${index} rendering failed`);
 * }
 * });
 * ```
 *
 * @see {@link renderWithRenderer | renderWithRenderer} for rendering with specific renderer types
 * @see {@link addToRender | addToRender} for adding entities to the render pipeline
 */
export async function batchRender(
  entities: IEntity[],
  context?: Record<string, unknown>
): Promise<(React.ReactElement | null | void)[]> {
  try {
    const renderManager = getManager("render");
    if (!renderManager) {
      throw new Error("RenderManager not available");
    }

    const renderManagerObj = renderManager as Record<string, unknown>;

    if (typeof renderManagerObj.batchRender === "function") {
      const batchRenderMethod = renderManagerObj.batchRender as (
        entities: IEntity[],
        context?: Record<string, unknown>
      ) => Promise<(React.ReactElement | null | void)[]>;
      return await batchRenderMethod(entities, context);
    }

    const results = [] as (React.ReactElement | null | void)[];
    for (const entity of entities) {
      const result = await renderWithRenderer(entity, "react", context);
      results.push(result);
    }
    return results;
  } catch (error) {
    console.error("Failed to batch render entities:", error);
    return [];
  }
}
