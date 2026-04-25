import type { ReactElement } from "react";
import type { IEntity } from "../../entity";
import type {
  IRender,
  IRenderContext,
  RenderResult,
  IRenderStrategy,
  ICanvasRenderer,
  IReactRenderer,
  ISSRRenderer,
  RenderPerformanceStats,
} from "../types";
import type { RenderStrategySelectorRuntimeConfig } from "../strategy-config";
import type { DirtyRegion } from "./types";

export type RenderModuleRenderOutput = ReactElement | string | Promise<string> | null | void;

export type RenderCanvasArtifacts = {
  renderer?: ICanvasRenderer | undefined;
  context?: IRenderContext | undefined;
  canvas?: HTMLCanvasElement | undefined;
  c2d?: CanvasRenderingContext2D | undefined;
};

export interface IEntityLifecycleTracker {
  /**
   * Bootstraps the tracker with an initial set of entities.
   * @param entities - The entities to bootstrap with.
   * @param options - Optional configuration for bootstrapping.
   * @returns The number of entities successfully bootstrapped.
   */
  bootstrap(entities: Iterable<IEntity>, options?: { markDirty?: boolean }): number;

  /**
   * Adds a single entity to the tracker.
   * @param entity - The entity to add.
   * @param options - Optional configuration for adding the entity.
   */
  addEntity(entity: IEntity, options?: { markDirty?: boolean }): void;

  /**
   * Removes an entity from the tracker by its ID.
   * @param entityId - The ID of the entity to remove.
   * @param options - Optional configuration for removal.
   */
  removeEntity(entityId: string, options?: { markDirty?: boolean; schedule?: boolean }): void;

  /**
   * Renders a specific entity by its ID.
   * @param entityId - The ID of the entity to render.
   * @returns The render output for the entity.
   */
  render(entityId: string): RenderModuleRenderOutput;

  /**
   * Renders all entities using the provided canvas artifacts.
   * @param getArtifacts - A function that returns the canvas artifacts.
   */
  renderAll(getArtifacts: () => RenderCanvasArtifacts): void;

  /**
   * Marks an entity as dirty with a reason.
   * @param entity - The entity to mark as dirty.
   * @param reason - The reason for marking as dirty.
   * @returns True if the entity was successfully marked as dirty.
   */
  markEntityDirty(entity: IEntity, reason: string): boolean;

  /**
   * Marks an entity as dirty by its ID with a reason.
   * @param entityId - The ID of the entity to mark as dirty.
   * @param reason - The reason for marking as dirty.
   * @returns True if the entity was successfully marked as dirty.
   */
  markEntityDirtyById(entityId: string, reason: string): boolean;

  /**
   * Schedules a flush of dirty entities.
   */
  scheduleDirtyFlush(): void;

  /**
   * Gets the cached render result for an entity.
   * @param entityId - The ID of the entity.
   * @returns The cached render result or undefined if not found.
   */
  getCachedRender(entityId: string): RenderResult | undefined;

  /**
   * Gets an entity by its ID.
   * @param entityId - The ID of the entity.
   * @returns The entity or undefined if not found.
   */
  getEntity(entityId: string): IEntity | undefined;

  /**
   * Gets all entities.
   * @returns An iterable of all entities.
   */
  getEntities(): Iterable<IEntity>;

  /**
   * Gets the number of entities in the tracker.
   * @returns The size of the entity collection.
   */
  getSize(): number;

  /**
   * Gets the number of render results cached.
   * @returns The size of the render results cache.
   */
  getRenderResultsSize(): number;

  /**
   * Gets the entity map.
   * @returns A map of entity IDs to entities.
   */
  getEntityMap(): Map<string, IEntity>;

  /**
   * Sets the render strategy for the tracker.
   * @param strategy - The render strategy to set.
   */
  setRenderStrategy(strategy: IRenderStrategy): void;

  /**
   * Sets the strategy context builder function.
   * @param builder - The builder function that creates render contexts for entities.
   */
  setStrategyContextBuilder(builder: (entity: IEntity) => IRenderContext): void;

  /**
   * Marks an entity as visible in a specific view.
   * @param viewId - The ID of the view.
   * @param entityId - The ID of the entity.
   */
  markEntityVisible(viewId: string, entityId: string): void;

  /**
   * Marks an entity as invisible in a specific view.
   * @param viewId - The ID of the view.
   * @param entityId - The ID of the entity.
   */
  markEntityInvisible(viewId: string, entityId: string): void;

  /**
   * Checks if an entity is visible in a specific view.
   * @param viewId - The ID of the view.
   * @param entityId - The ID of the entity.
   * @returns True if the entity is visible in the view.
   */
  isEntityVisibleInView(viewId: string, entityId: string): boolean;

  /**
   * Gets all visible entities in a specific view.
   * @param viewId - The ID of the view.
   * @returns A set of visible entity IDs.
   */
  getVisibleEntities(viewId: string): Set<string>;

  /**
   * Sets the visibility of multiple entities in a view.
   * @param viewId - The ID of the view.
   * @param entityIds - The IDs of the entities to set visibility for.
   */
  setViewVisibility(viewId: string, entityIds: Iterable<string>): void;

  /**
   * Clears the visibility settings for a view.
   * @param viewId - The ID of the view.
   */
  clearViewVisibility(viewId: string): void;

  /**
   * Clears the visibility settings for an entity across all views.
   * @param entityId - The ID of the entity.
   */
  clearEntityVisibility(entityId: string): void;

  /**
   * Gets all views that an entity is visible in.
   * @param entityId - The ID of the entity.
   * @returns A set of view IDs.
   */
  getViewsForEntity(entityId: string): Set<string>;

  /**
   * Disposes of the tracker and cleans up resources.
   */
  dispose(): void;
}

export interface IRenderCacheCoordinator {
  /**
   * Gets the current version of the cache.
   * @returns The cache version number.
   */
  getVersion(): number;

  /**
   * Increments the cache version.
   * @returns The new cache version number.
   */
  bumpVersion(): number;

  /**
   * Sets the render context for the coordinator.
   * @param context - The render context to set.
   */
  setRenderContext(context: IRenderContext): void;

  /**
   * Gets the current render context.
   * @returns The render context or undefined if not set.
   */
  getRenderContext(): IRenderContext | undefined;

  /**
   * Updates the render context with partial updates.
   * @param updates - The partial updates to apply.
   */
  updateRenderContext(updates: Partial<IRenderContext>): void;

  /**
   * Renders all entities using the provided tracker.
   * @param tracker - The entity lifecycle tracker.
   */
  renderAll(tracker: IEntityLifecycleTracker): void;

  /**
   * Gets the canvas artifacts.
   * @returns The canvas artifacts.
   */
  getCanvasArtifacts(): RenderCanvasArtifacts;

  /**
   * Gets performance statistics.
   * @returns The performance stats.
   */
  getPerformanceStats(): RenderPerformanceStats;

  /**
   * Sets the canvas resolver function.
   * @param resolver - The resolver function for canvas renderers.
   */
  setCanvasResolver(resolver: (rendererId?: string) => ICanvasRenderer | undefined): void;

  /**
   * Disposes of the coordinator and cleans up resources.
   */
  dispose(): void;
}

export interface IRenderOrchestrator {
  /**
   * Registers a renderer with the given name.
   * @param name - The name of the renderer.
   * @param renderer - The renderer instance.
   */
  registerRenderer(name: string, renderer: IRender): void;

  /**
   * Unregisters a renderer by name.
   * @param name - The name of the renderer to unregister.
   * @returns True if the renderer was successfully unregistered.
   */
  unregisterRenderer(name: string): boolean;

  /**
   * Gets a renderer by name.
   * @param name - The name of the renderer.
   * @returns The renderer or undefined if not found.
   */
  getRenderer(name: string): IRender | undefined;

  /**
   * Gets all registered renderer names.
   * @returns An array of registered renderer names.
   */
  getRegisteredRenderers(): string[];

  /**
   * Sets the default renderer.
   * @param name - The name of the renderer to set as default.
   * @returns True if the default renderer was successfully set.
   */
  setDefaultRenderer(name: string): boolean;

  /**
   * Gets the name of the default renderer.
   * @returns The name of the default renderer.
   */
  getDefaultRenderer(): string;

  /**
   * Selects an appropriate renderer for the given entity.
   * @param entity - The entity to select a renderer for.
   * @returns The selected renderer or null if none suitable.
   */
  selectRenderer(entity: IEntity): IRender | null;

  /**
   * Configures the strategy selector with runtime config.
   * @param config - The runtime configuration.
   */
  configureStrategySelector(config?: RenderStrategySelectorRuntimeConfig): void;

  /**
   * Builds a render context for the given entity.
   * @param entity - The entity to build context for.
   * @returns The render context.
   */
  buildStrategyContext(entity: IEntity): IRenderContext;

  /**
   * Refreshes the render strategy.
   */
  refreshRenderStrategy(): void;

  /**
   * Attaches an entity lifecycle tracker.
   * @param tracker - The entity tracker to attach.
   */
  attachEntityTracker(tracker: IEntityLifecycleTracker): void;

  /**
   * Attaches a render cache coordinator.
   * @param cache - The cache coordinator to attach.
   */
  attachCacheCoordinator(cache: IRenderCacheCoordinator): void;

  /**
   * Resolves a canvas renderer by ID.
   * @param rendererId - The optional renderer ID.
   * @returns The canvas renderer or undefined.
   */
  resolveCanvasRenderer(rendererId?: string): ICanvasRenderer | undefined;

  /**
   * Resolves a React renderer by ID.
   * @param rendererId - The optional renderer ID.
   * @returns The React renderer or undefined.
   */
  resolveReactRenderer(rendererId?: string): IReactRenderer | undefined;

  /**
   * Resolves an SSR renderer by ID.
   * @param rendererId - The optional renderer ID.
   * @returns The SSR renderer or undefined.
   */
  resolveSSRRenderer(rendererId?: string): ISSRRenderer | undefined;

  /**
   * Resolves a WebGPU renderer by ID.
   * @param rendererId - The optional renderer ID.
   * @returns The WebGPU renderer or undefined.
   */
  resolveWebGPURenderer(rendererId?: string): IRender | undefined;
}

export interface IDirtyRegionCoordinator {
  /**
   * Schedules a redraw operation.
   * @param trigger - Optional trigger identifier.
   */
  scheduleRedraw(trigger?: string): void;

  /**
   * Requests a full redraw with a reason.
   * @param reason - The reason for the full redraw.
   */
  requestFullRedraw(reason: string): void;

  /**
   * Marks an entity as dirty with a reason.
   * @param entity - The entity to mark as dirty.
   * @param reason - The reason for marking as dirty.
   * @returns True if the entity was successfully marked as dirty.
   */
  markEntityDirty(entity: IEntity, reason: string): boolean;

  /**
   * Marks an entity as dirty by ID with a reason.
   * @param entityId - The ID of the entity to mark as dirty.
   * @param reason - The reason for marking as dirty.
   * @returns True if the entity was successfully marked as dirty.
   */
  markEntityDirtyById(entityId: string, reason: string): boolean;

  /**
   * Gets the current dirty regions.
   * @returns An array of dirty regions.
   */
  getDirtyRegions(): DirtyRegion[];

  /**
   * Gets the IDs of dirty entities.
   * @returns An array of dirty entity IDs.
   */
  getDirtyEntityIds(): string[];

  /**
   * Checks if a full redraw is pending.
   * @returns True if a full redraw is pending.
   */
  isFullRedrawPending(): boolean;

  /**
   * Sets the full redraw pending state.
   * @param value - The pending state to set.
   */
  setFullRedrawPending(value: boolean): void;

  /**
   * Attaches a canvas artifacts provider.
   * @param provider - The provider function.
   */
  attachCanvasArtifactsProvider(provider: () => RenderCanvasArtifacts): void;

  /**
   * Attaches an entity lifecycle tracker.
   * @param tracker - The entity tracker to attach.
   */
  attachEntityTracker(tracker: IEntityLifecycleTracker): void;

  /**
   * Sets the render executor functions.
   * @param executor - The main render executor.
   * @param onEntityUpdate - Optional callback for entity updates.
   */
  setRenderExecutor(executor: () => void, onEntityUpdate?: () => void): void;

  /**
   * Schedules a flush of dirty regions.
   */
  scheduleDirtyFlush(): void;
}

export interface IRenderEventBridge {
  /**
   * Attaches the event bridge to start listening for events.
   */
  attach(): void;

  /**
   * Detaches the event bridge to stop listening for events.
   */
  detach(): void;
}
