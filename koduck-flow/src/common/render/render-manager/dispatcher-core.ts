import type { ReactElement } from "react";
import type { IDisposable } from "../../disposable";
import type { EntityManager, IEntity } from "../../entity";
import type { RegistryManager } from "../../registry";
import type { IRender, RenderResult, IRenderContext, IRenderConfig } from "../types";
import type { RenderStrategySelectorRuntimeConfig } from "../strategy-config";
import { diagnostics } from "../render-diagnostics";
import { RenderFrameScheduler, type FrameBackpressureEvent } from "./render-frame-scheduler";
import { RenderMetricsModule, type RenderMetricsModuleDependencies } from "./render-metrics-module";
import { VisibilityModule } from "./visibility";
import { EntityLifecycleTracker } from "./entity-lifecycle-tracker";
import { DirtyRegionCoordinator } from "./dirty-region-coordinator";
import { RenderCacheCoordinator } from "./render-cache-coordinator";
import { RenderOrchestrator, type RenderOrchestratorOptions } from "./render-orchestrator";
import { EventBridgeModule } from "./event-bridge-module";
import type { RenderManagerDependencies, RenderStats, DirtyRegion } from "./types";

/**
 * Render Dispatcher Core - Internal Rendering System Implementation
 *
 * This module provides the internal core implementation of the rendering system.
 * It was extracted from the legacy RenderDispatcher to provide:
 * - Clear separation between public API (façade) and internal complexity
 * - Reusability across different public facades (main API, tests, alternative interfaces)
 * - Cleaner architecture and easier maintenance
 *
 * Key Responsibilities:
 * - Coordinate all render subsystems (metrics, dirty regions, entity tracking, cache, orchestration)
 * - Manage entity lifecycle and visibility
 * - Handle render scheduling and execution
 * - Monitor performance and backpressure
 * - Provide comprehensive statistics and diagnostics
 *
 * Architecture Pattern: Facade aggregator + Component orchestrator
 * - Acts as the central coordinator integrating 6+ major render subsystems
 * - Each subsystem has a specific responsibility (separation of concerns)
 * - Public methods delegate to appropriate subsystems
 *
 * Core Subsystems:
 * 1. **RenderMetricsModule**: Collects and analyzes performance metrics
 * 2. **RenderFrameScheduler**: Manages frame scheduling and backpressure
 * 3. **VisibilityModule**: Tracks entity visibility across views
 * 4. **EntityLifecycleTracker**: Manages entity lifecycle and rendering
 * 5. **DirtyRegionCoordinator**: Tracks dirty regions for partial rendering
 * 6. **RenderCacheCoordinator**: Manages render cache and context
 * 7. **RenderOrchestrator**: Selects and manages rendering strategies
 * 8. **EventBridgeModule**: Bridges render system with event system
 *
 * Initialization Process:
 * The constructor performs a complex initialization sequence:
 * 1. Initialize dependency injection
 * 2. Create frame scheduler (or use provided)
 * 3. Create all subsystems in dependency order
 * 4. Wire up callbacks and hooks between subsystems
 * 5. Record initialization metrics
 *
 * Concurrency Model:
 * - Frame scheduler handles frame-level backpressure
 * - Dirty region coordinator batches updates
 * - Entity tracker manages async render operations
 * - Cache coordinator ensures thread-safe cache operations
 *
 * Lifetime Management:
 * - Constructor: Initialize and wire all subsystems
 * - dispose(): Clean up all resources, unregister renderers, record statistics
 * - Implements IDisposable interface
 *
 * Usage Pattern (Internal - via RenderDispatcher façade):
 * This is an internal class not directly instantiated by end users.
 * Use `RenderDispatcher` (the public façade) instead.
 *
 * Performance Considerations:
 * - Uses efficient data structures (Set, Map) for entity tracking
 * - Batches dirty region updates via DirtyRegionCoordinator
 * - Implements frame rate limiting via RenderFrameScheduler
 * - Collects metrics for performance analysis
 *
 * @class RenderDispatcherCore
 * @implements {IDisposable}
 * @see {@link RenderDispatcher} for public API
 * @see {@link RenderMetricsModule} for metrics collection
 * @see {@link RenderFrameScheduler} for frame scheduling
 * @see {@link EntityLifecycleTracker} for entity management
 *
 * @example
 * ```typescript
 * // This class is typically not used directly
 * // Instead, use the public RenderDispatcher façade:
 *
 * import { createRenderDispatcher } from '@/render/render-manager';
 *
 * const dispatcher = createRenderDispatcher({
 *   renderEvents: eventManager,
 *   entityManager: entities,
 *   registryManager: registry,
 *   frameScheduler: scheduler,
 * });
 *
 * // Use dispatcher for all rendering operations
 * dispatcher.registerRenderer('canvas', canvasRenderer);
 * dispatcher.addEntityToRender(entity);
 * dispatcher.render(entity.id);
 * dispatcher.dispose();
 * ```
 */
export class RenderDispatcherCore implements IDisposable {
  /**
   * Component identifier name for diagnostics and logging
   * @readonly
   */
  readonly name = "RenderManager";

  /**
   * Component type identifier for system categorization
   * @readonly
   */
  readonly type = "render";

  /**
   * Injected dependencies for render system
   * Contains event managers and optional subsystem connections
   * @protected
   * @readonly
   */
  protected readonly deps: RenderManagerDependencies;

  /**
   * Optional connection to the registry manager for entity lookups
   * When connected, enables enhanced entity resolution capabilities
   * @protected
   */
  protected registryManager: RegistryManager | undefined;

  /**
   * Optional connection to the entity manager for lifecycle tracking
   * When connected, bootstraps entities and tracks lifecycle events
   * @protected
   */
  protected entityManager: EntityManager | undefined;

  /**
   * Callback invoked when entities are updated or flushed
   * Used for coordinating render operations with entity updates
   * @private
   */
  private entityUpdateCallback?: () => void;

  /**
   * Metrics collection module
   * Tracks performance statistics, lifecycle events, and system diagnostics
   * @protected
   * @readonly
   */
  protected readonly metrics: RenderMetricsModule;

  /**
   * Frame scheduling module
   * Manages frame rate limiting, backpressure handling, and frame callbacks
   * @protected
   * @readonly
   */
  protected readonly frameScheduler: RenderFrameScheduler;

  /**
   * Dirty region coordinator
   * Tracks and manages dirty regions for partial rendering optimization
   * Implements efficient batching of render updates
   * @readonly
   */
  readonly dirtyModule: DirtyRegionCoordinator;

  /**
   * Entity lifecycle tracker
   * Manages entity registration, rendering, and lifecycle events
   * Tracks entity visibility across views
   * @readonly
   */
  readonly entityTracker: EntityLifecycleTracker;

  /**
   * Visibility module
   * Tracks entity visibility state across different views
   * Supports partial and full visibility tracking
   * @protected
   * @readonly
   */
  protected readonly visibilityModule: VisibilityModule;

  /**
   * Render cache coordinator
   * Manages render caching, context, and canvas artifacts
   * Optimizes render performance through intelligent caching
   * @readonly
   */
  readonly cacheCoordinator: RenderCacheCoordinator;

  /**
   * Render orchestrator
   * Selects and manages rendering strategies
   * Handles renderer registration and selection
   * @protected
   */
  protected orchestrator: RenderOrchestrator;

  /**
   * Event bridge module
   * Bridges the render system with the event system
   * Translates events into render operations
   * @protected
   * @readonly
   */
  protected readonly eventBridgeModule: EventBridgeModule;

  /**
   * Constructor
   *
   * Initializes the RenderDispatcherCore with complex subsystem setup:
   *
   * Initialization Sequence:
   * 1. Store dependencies and optional manager connections
   * 2. Create frame scheduler (or use provided one)
   * 3. Initialize metrics module with dependencies
   * 4. Initialize visibility module
   * 5. Create cache coordinator (must happen before orchestrator)
   * 6. Create dirty region coordinator
   * 7. Create entity lifecycle tracker
   * 8. Create render orchestrator
   * 9. Wire up internal callbacks and inter-module communication
   * 10. Attach to render events
   * 11. Record initialization metrics
   *
   * Wire-up Process:
   * - Frame scheduler backpressure listener → metrics recording
   * - Dirty module callbacks → redraw scheduling
   * - Entity tracker callbacks → dirty region and full redraw management
   * - Event bridge callbacks → entity tracking and dirty management
   *
   * Dependency Order (Critical):
   * Some subsystems must be created in a specific order due to their dependencies:
   * - frameScheduler must exist before dirtyModule
   * - cacheCoordinator must exist before orchestrator
   * - orchestrator must be attached before dirtyModule attaches entityTracker
   *
   * @param deps - Render manager dependencies
   * - `renderEvents` (required): Event manager for render lifecycle
   * - `registryManager` (optional): Registry for entity lookups
   * - `entityManager` (optional): Entity manager for lifecycle tracking
   * - `frameScheduler` (optional): Custom frame scheduler (default created if omitted)
   *
   * @throws {Error} If required dependencies are missing or initialization fails
   *
   * @example
   * ```typescript
   * const core = new RenderDispatcherCore({
   *   renderEvents: eventManager,
   *   registryManager: registry,
   *   entityManager: entityMgr,
   * });
   * // All subsystems initialized and wired up
   * ```
   */
  constructor(deps: RenderManagerDependencies) {
    this.deps = deps;
    this.registryManager = deps.registryManager;
    this.entityManager = deps.entityManager;

    this.frameScheduler = deps.frameScheduler ?? new RenderFrameScheduler();
    this.metrics = new RenderMetricsModule(this.createMetricsDependencies());
    this.frameScheduler.setBackpressureListener((event) => this.recordBackpressure(event));

    this.visibilityModule = new VisibilityModule(this.metrics.meter);

    this.cacheCoordinator = new RenderCacheCoordinator({
      metrics: this.metrics,
      resolveCanvasRenderer: (rendererId) =>
        this.orchestrator?.resolveCanvasRenderer(rendererId) ?? undefined,
    });

    this.dirtyModule = new DirtyRegionCoordinator({
      metrics: this.metrics,
      frameScheduler: this.frameScheduler,
      canvasArtifactsProvider: () => this.cacheCoordinator.getCanvasArtifacts(),
      trackedEntitiesProvider: () => this.entityTracker?.getEntities() ?? [],
      onFullRedraw: (reason) => this.scheduleRedraw(reason),
      onPartialFlush: () => this.entityUpdateCallback?.(),
    });

    this.entityTracker = new EntityLifecycleTracker({
      dirtyRegionManager: this.dirtyModule.getManager(),
      visibilityModule: this.visibilityModule,
      meter: this.metrics.meter,
      scheduleDirtyFlush: () => this.dirtyModule.scheduleDirtyFlush(),
      requestFullRedraw: (reason) => this.dirtyModule.requestFullRedraw(reason),
      resolveExternalEntity: (entityId) => this.resolveExternalEntity(entityId),
    });

    const orchestratorOptions: RenderOrchestratorOptions = {
      entityTracker: this.entityTracker,
      cacheCoordinator: this.cacheCoordinator,
      ...(this.registryManager ? { registryManager: this.registryManager } : {}),
    };
    this.orchestrator = new RenderOrchestrator(orchestratorOptions);
    this.orchestrator.attachEntityTracker(this.entityTracker);
    this.orchestrator.attachCacheCoordinator(this.cacheCoordinator);

    this.dirtyModule.attachEntityTracker(this.entityTracker);
    this.configureRedrawExecutor();

    this.eventBridgeModule = new EventBridgeModule({
      renderEvents: deps.renderEvents,
      metrics: this.metrics,
      getTrackedEntity: (entityId) => this.entityTracker.getEntity(entityId),
      markEntityDirtyById: (entityId, reason) =>
        this.entityTracker.markEntityDirtyById(entityId, reason),
      trackEntityForPartialUpdate: (entity, reason) =>
        this.entityTracker.markEntityDirty(entity, reason),
      removeEntityFromRender: (entityId, options) =>
        this.entityTracker.removeEntity(entityId, options),
      requestFullRedraw: (reason) => this.dirtyModule.requestFullRedraw(reason),
      scheduleDirtyFlush: () => this.entityTracker.scheduleDirtyFlush(),
    });

    this.attachToRenderEvents();
    this.metrics.recordLifecycle("init", {
      renderer_count: this.orchestrator.getRegisteredRenderers().length,
      default_renderer: this.orchestrator.getDefaultRenderer(),
      registry_connected: Boolean(this.registryManager),
      entity_connected: Boolean(this.entityManager),
    });
    diagnostics.info("RenderManager initialized", {
      rendererCount: this.orchestrator.getRegisteredRenderers().length,
      defaultRenderer: this.orchestrator.getDefaultRenderer(),
      registryConnected: Boolean(this.registryManager),
      entityManagerConnected: Boolean(this.entityManager),
    });
  }

  /**
   * Get the default renderer name
   *
   * Retrieves the name of the currently configured default renderer.
   * This is the renderer used when no specific renderer is selected.
   *
   * @returns The name of the default renderer
   *
   * @example
   * ```typescript
   * const defaultName = dispatcher.defaultRenderer;
   * console.log(`Using renderer: ${defaultName}`);
   * ```
   */
  get defaultRenderer(): string {
    return this.orchestrator.getDefaultRenderer();
  }

  /**
   * Set the default renderer
   *
   * Changes the default renderer used for subsequent render operations.
   * Validates that the renderer exists and is registered.
   *
   * @param name - Name of the renderer to set as default
   *
   * @throws {Error} If the renderer is not registered
   *
   * @example
   * ```typescript
   * dispatcher.defaultRenderer = 'canvas-renderer';
   * ```
   */
  set defaultRenderer(name: string) {
    this.orchestrator.setDefaultRenderer(name);
  }

  /**
   * Get current render statistics
   *
   * Returns comprehensive statistics about the current rendering state:
   * - Queue size and dirty region count
   * - Dirty entity count and pending full redraw status
   * - Performance metrics (FPS, memory, etc.)
   *
   * @returns RenderStats object with current system statistics
   *
   * @example
   * ```typescript
   * const stats = dispatcher.getRenderStats();
   * console.log(`Dirty regions: ${stats.dirtyRegionCount}`);
   * console.log(`Queue size: ${stats.queueSize}`);
   * ```
   *
   * @see {@link RenderStats} for statistics interface
   */
  getRenderStats(): RenderStats {
    return this.metrics.getRenderStats();
  }

  /**
   * Get current dirty regions
   *
   * Returns all currently tracked dirty regions (areas that need re-rendering).
   * Dirty regions are calculated based on entity updates and visibility changes.
   *
   * @returns Array of dirty regions (bounds coordinates and dimensions)
   *
   * @example
   * ```typescript
   * const dirtyRegions = dispatcher.getDirtyRegions();
   * console.log(`Found ${dirtyRegions.length} dirty regions`);
   * ```
   *
   * @see {@link DirtyRegion} for region format
   */
  getDirtyRegions(): DirtyRegion[] {
    return this.dirtyModule.getDirtyRegions();
  }

  /**
   * Get IDs of all dirty entities
   *
   * Returns the list of entity IDs that have been marked as dirty
   * and need re-rendering in the next frame.
   *
   * @returns Array of entity IDs marked as dirty
   *
   * @example
   * ```typescript
   * const dirtyIds = dispatcher.getDirtyEntityIds();
   * console.log(`Entities needing render: ${dirtyIds.join(', ')}`);
   * ```
   */
  getDirtyEntityIds(): string[] {
    return this.dirtyModule.getDirtyEntityIds();
  }

  /**
   * Get all tracked entities
   *
   * Returns an iterable of all entities currently tracked for rendering.
   * Includes both visible and invisible entities.
   *
   * @returns Iterable of IEntity objects
   *
   * @example
   * ```typescript
   * const entities = dispatcher.getTrackedEntities();
   * for (const entity of entities) {
   *   console.log(`Entity: ${entity.id}`);
   * }
   * ```
   */
  getTrackedEntities(): Iterable<IEntity> {
    return this.entityTracker.getEntities();
  }

  /**
   * Get all tracked entities as a read-only map
   *
   * Returns a read-only map of entity ID to IEntity for efficient lookup.
   * More efficient than getTrackedEntities() for individual entity access.
   *
   * @returns ReadonlyMap mapping entity IDs to entities
   *
   * @example
   * ```typescript
   * const entityMap = dispatcher.getTrackedEntityMap();
   * const entity = entityMap.get('entity-123');
   * if (entity) {
   *   console.log(`Found entity: ${entity.id}`);
   * }
   * ```
   */
  getTrackedEntityMap(): ReadonlyMap<string, IEntity> {
    return this.entityTracker.getEntityMap();
  }

  /**
   * Get current render version number
   *
   * Returns a version counter that increments each time rendering state changes.
   * Useful for detecting when cache invalidation is needed.
   *
   * @returns Current version number
   *
   * @example
   * ```typescript
   * const currentVersion = dispatcher.getVersion();
   * // ... perform operations ...
   * if (dispatcher.getVersion() !== currentVersion) {
   *   console.log('Render state changed');
   * }
   * ```
   */
  getVersion(): number {
    return this.cacheCoordinator.getVersion();
  }

  /**
   * Initialize render configuration
   *
   * Applies initial configuration to the render system including:
   * - Setting render context if provided
   * - Configuring strategy selector
   * - Scheduling initial redraw if needed
   *
   * @param config - Render configuration object (optional)
   * - `renderContext`: Initial render context
   * - `strategySelector`: Custom strategy selector configuration
   *
   * @example
   * ```typescript
   * dispatcher.init({
   *   renderContext: { viewport: { width: 800, height: 600 } },
   *   strategySelector: { mode: 'optimal' },
   * });
   * ```
   *
   * @see {@link IRenderConfig} for configuration interface
   */
  init(config?: IRenderConfig): void {
    if (config?.renderContext) {
      this.cacheCoordinator.setRenderContext(config.renderContext);
      this.scheduleRedraw("context_init");
    }

    if (config && "strategySelector" in config) {
      this.configureStrategySelector(config.strategySelector);
    }
  }

  /**
   * Attach to render event system
   *
   * Enables event bridging so that external render events trigger render operations.
   * Should be called during initialization to enable event-driven rendering.
   *
   * @example
   * ```typescript
   * dispatcher.attachToRenderEvents();
   * ```
   *
   * @see {@link detachFromRenderEvents}
   */
  attachToRenderEvents(): void {
    this.eventBridgeModule.attach();
  }

  /**
   * Detach from render event system
   *
   * Disables event bridging to prevent external events from triggering render operations.
   * Useful for pause/suspend scenarios or during cleanup.
   *
   * @example
   * ```typescript
   * dispatcher.detachFromRenderEvents();
   * ```
   *
   * @see {@link attachToRenderEvents}
   */
  detachFromRenderEvents(): void {
    this.eventBridgeModule.detach();
  }

  /**
   * Register a renderer with the system
   *
   * Makes a renderer available for selection and use by the system.
   * Once registered, the renderer can be selected via strategy selection.
   *
   * @param name - Unique identifier for the renderer
   * @param renderer - Renderer implementation (IRender interface)
   *
   * @throws {Error} If a renderer with the same name is already registered
   *
   * @example
   * ```typescript
   * dispatcher.registerRenderer('canvas', new CanvasRenderer());
   * dispatcher.registerRenderer('svg', new SVGRenderer());
   * ```
   *
   * @see {@link unregisterRenderer}
   * @see {@link getRenderer}
   * @see {@link getRegisteredRenderers}
   */
  registerRenderer(name: string, renderer: IRender): void {
    this.orchestrator.registerRenderer(name, renderer);
  }

  /**
   * Unregister a renderer from the system
   *
   * Removes a renderer from the available pool. Entities using this renderer
   * will need to be re-rendered with a different renderer.
   *
   * @param name - Name of the renderer to unregister
   * @returns true if renderer was found and unregistered, false if not found
   *
   * @throws {Error} If unregistering the default renderer
   *
   * @example
   * ```typescript
   * const wasRemoved = dispatcher.unregisterRenderer('old-renderer');
   * if (wasRemoved) {
   *   console.log('Renderer removed successfully');
   * }
   * ```
   *
   * @see {@link registerRenderer}
   */
  unregisterRenderer(name: string): boolean {
    return this.orchestrator.unregisterRenderer(name);
  }

  /**
   * Get a specific registered renderer by name
   *
   * Retrieves a renderer instance that was previously registered.
   *
   * @param name - Name of the renderer to retrieve
   * @returns Renderer instance if found, undefined if not registered
   *
   * @example
   * ```typescript
   * const renderer = dispatcher.getRenderer('canvas');
   * if (renderer) {
   *   console.log('Canvas renderer is available');
   * }
   * ```
   *
   * @see {@link registerRenderer}
   * @see {@link getRegisteredRenderers}
   */
  getRenderer(name: string): IRender | undefined {
    return this.orchestrator.getRenderer(name);
  }

  /**
   * Get names of all registered renderers
   *
   * Returns a list of all renderer names available in the system.
   *
   * @returns Array of registered renderer names
   *
   * @example
   * ```typescript
   * const renderers = dispatcher.getRegisteredRenderers();
   * console.log(`Available renderers: ${renderers.join(', ')}`);
   * ```
   *
   * @see {@link getRenderer}
   * @see {@link registerRenderer}
   */
  getRegisteredRenderers(): string[] {
    return this.orchestrator.getRegisteredRenderers();
  }

  /**
   * Set the default renderer by name
   *
   * Changes which renderer is used as the default for entity rendering.
   * The renderer must already be registered.
   *
   * @param name - Name of an already-registered renderer
   * @returns true if renderer was set successfully, false if renderer not found
   *
   * @example
   * ```typescript
   * const success = dispatcher.setDefaultRenderer('canvas');
   * if (!success) {
   *   console.warn('Renderer not found');
   * }
   * ```
   *
   * @see {@link getDefaultRenderer}
   * @see {@link registerRenderer}
   */
  setDefaultRenderer(name: string): boolean {
    return this.orchestrator.setDefaultRenderer(name);
  }

  /**
   * Get the current default renderer name
   *
   * Retrieves the name of the renderer currently configured as default.
   *
   * @returns Name of the default renderer
   *
   * @example
   * ```typescript
   * const defaultRenderer = dispatcher.getDefaultRenderer();
   * console.log(`Default: ${defaultRenderer}`);
   * ```
   *
   * @see {@link setDefaultRenderer}
   */
  getDefaultRenderer(): string {
    return this.orchestrator.getDefaultRenderer();
  }

  /**
   * Connect to an entity manager
   *
   * Establishes connection to an external entity manager for entity lifecycle tracking.
   * Bootstraps all existing entities and enables lifecycle event handling.
   *
   * @param entityManager - Entity manager instance implementing EntityManager interface
   *
   * @throws {Error} If entity manager is invalid
   *
   * @example
   * ```typescript
   * dispatcher.connectToEntityManager(myEntityManager);
   * // All entities are now tracked for rendering
   * ```
   *
   * @see {@link connectToRegistryManager}
   */
  connectToEntityManager(entityManager: EntityManager): void {
    this.entityManager = entityManager;
    this.entityTracker.setExternalEntityResolver((entityId) =>
      this.resolveExternalEntity(entityId)
    );

    const entities = entityManager.getEntities?.() ?? [];
    const initialized = this.entityTracker.bootstrap(entities, { markDirty: false });

    if (initialized > 0) {
      this.dirtyModule.requestFullRedraw("entity_manager_init");
    }

    this.metrics.recordConnection("entity", {
      initialized_entities: initialized,
      needs_initial_redraw: initialized > 0,
    });
    diagnostics.info("EntityManager connected", {
      initializedEntities: initialized,
      needsInitialRedraw: initialized > 0,
    });
  }

  /**
   * Connect to a registry manager
   *
   * Establishes connection to an external registry manager for entity lookups.
   * Enables enhanced entity resolution and registry-based rendering strategies.
   *
   * @param registryManager - Registry manager instance
   *
   * @throws {Error} If registry manager is invalid
   *
   * @example
   * ```typescript
   * dispatcher.connectToRegistryManager(myRegistryManager);
   * ```
   *
   * @see {@link connectToEntityManager}
   */
  connectToRegistryManager(registryManager: RegistryManager): void {
    this.registryManager = registryManager;
    this.orchestrator.registerRegistryManager(registryManager);
    this.metrics.recordConnection("registry", {
      registry_count: registryManager.getRegistryNames().length,
      renderer_count: this.orchestrator.getRegisteredRenderers().length,
    });
    diagnostics.info("RegistryManager connected", {
      registryCount: registryManager.getRegistryNames().length,
      renderers: this.orchestrator.getRegisteredRenderers(),
    });
  }

  /**
   * Set entity update callback
   *
   * Registers a callback that will be invoked when entities are updated or flushed.
   * Used for coordinating render operations with entity lifecycle events.
   *
   * @param callback - Function to call on entity updates
   *
   * @example
   * ```typescript
   * dispatcher.setEntityUpdateCallback(() => {
   *   console.log('Entities updated');
   *   // Perform post-update operations
   * });
   * ```
   */
  setEntityUpdateCallback(callback: () => void): void {
    this.entityUpdateCallback = callback;
    this.configureRedrawExecutor();
  }

  /**
   * Add entity to rendering system
   *
   * Registers an entity for rendering and tracking.
   * The entity will be tracked for visibility, dirty state, and rendering.
   *
   * @param entity - Entity to add for rendering
   * @param options - Configuration options
   * - `markDirty` (optional): If true, mark entity as dirty immediately
   *
   * @example
   * ```typescript
   * dispatcher.addEntityToRender(myEntity, { markDirty: true });
   * ```
   *
   * @see {@link removeEntityFromRender}
   */
  addEntityToRender(entity: IEntity, options?: { markDirty?: boolean }): void {
    this.entityTracker.addEntity(entity, options);
  }

  /**
   * Remove entity from rendering system
   *
   * Unregisters an entity from rendering and stops tracking it.
   * The entity will no longer be rendered or checked for visibility.
   *
   * @param entityId - ID of the entity to remove
   * @param options - Configuration options
   * - `markDirty` (optional): If true, mark dirty before removal
   * - `schedule` (optional): If true, schedule redraw after removal
   *
   * @example
   * ```typescript
   * dispatcher.removeEntityFromRender('entity-123', { schedule: true });
   * ```
   *
   * @see {@link addEntityToRender}
   */
  removeEntityFromRender(
    entityId: string,
    options?: { markDirty?: boolean; schedule?: boolean }
  ): void {
    this.entityTracker.removeEntity(entityId, options);
  }

  /**
   * Render a specific entity
   *
   * Renders a single entity using the appropriate renderer selected for that entity.
   * Returns the render result (React element, string, or promise).
   *
   * @param entityId - ID of the entity to render
   * @returns Render result from the renderer (ReactElement, string, Promise, null, or void)
   *
   * @throws {Error} If entity not found or rendering fails
   *
   * @example
   * ```typescript
   * const result = dispatcher.render('entity-123');
   * if (result instanceof Promise) {
   *   const str = await result;
   *   console.log(str);
   * }
   * ```
   */
  render(entityId: string): ReactElement | string | Promise<string> | null | void {
    return this.entityTracker.render(entityId);
  }

  /**
   * Get cached render result for an entity
   *
   * Retrieves the previously rendered result from the cache without re-rendering.
   * Useful for performance-sensitive scenarios where render caching is important.
   *
   * @param entityId - ID of the entity
   * @returns Cached render result if available, undefined if not cached or entity doesn't exist
   *
   * @example
   * ```typescript
   * const cached = dispatcher.getCachedRender('entity-123');
   * if (cached) {
   *   console.log('Using cached result');
   * }
   * ```
   *
   * @see {@link render}
   */
  getCachedRender(entityId: string): RenderResult | undefined {
    return this.entityTracker.getCachedRender(entityId);
  }

  /**
   * Select an appropriate renderer for an entity
   *
   * Uses the strategy selector to choose the best renderer for a given entity.
   * The selection is based on entity properties and registered renderer capabilities.
   *
   * @param entity - Entity to select a renderer for
   * @returns Selected renderer, or null if no suitable renderer found
   *
   * @example
   * ```typescript
   * const renderer = dispatcher.selectRenderer(myEntity);
   * if (renderer) {
   *   console.log('Renderer selected:', renderer.name);
   * } else {
   *   console.warn('No suitable renderer found');
   * }
   * ```
   *
   * @see {@link registerRenderer}
   * @see {@link getDefaultRenderer}
   */
  selectRenderer(entity: IEntity): IRender | null {
    return this.orchestrator.selectRenderer(entity);
  }

  /**
   * Set the render context
   *
   * Applies a new render context (e.g., viewport, styling, configuration).
   * Triggers a full redraw since context affects all entities.
   *
   * @param context - New render context to apply
   *
   * @example
   * ```typescript
   * dispatcher.setRenderContext({
   *   viewport: { x: 0, y: 0, width: 800, height: 600 },
   *   theme: 'dark',
   * });
   * ```
   *
   * @see {@link getRenderContext}
   * @see {@link updateRenderContext}
   */
  setRenderContext(context: IRenderContext): void {
    this.cacheCoordinator.setRenderContext(context);
    this.metrics.recordContextOperation("set");
    this.scheduleRedraw("context_set");
  }

  /**
   * Get the current render context
   *
   * Retrieves the currently active render context.
   *
   * @returns Current render context, or undefined if not set
   *
   * @example
   * ```typescript
   * const context = dispatcher.getRenderContext();
   * if (context) {
   *   console.log(`Viewport: ${context.viewport.width}x${context.viewport.height}`);
   * }
   * ```
   *
   * @see {@link setRenderContext}
   */
  getRenderContext(): IRenderContext | undefined {
    return this.cacheCoordinator.getRenderContext();
  }

  /**
   * Update render context with partial changes
   *
   * Applies partial updates to the existing render context.
   * More efficient than setRenderContext() when only certain properties change.
   *
   * @param updates - Partial context object with properties to update
   *
   * @example
   * ```typescript
   * dispatcher.updateRenderContext({ theme: 'light' });
   * // Other context properties remain unchanged
   * ```
   *
   * @see {@link setRenderContext}
   * @see {@link getRenderContext}
   */
  updateRenderContext(updates: Partial<IRenderContext>): void {
    this.cacheCoordinator.updateRenderContext(updates);
    this.metrics.recordContextOperation("update");
    this.scheduleRedraw("context_update");
  }

  /**
   * Force render all tracked entities
   *
   * Triggers rendering of all tracked entities regardless of dirty state.
   * Useful for full screen refreshes or cache clearing.
   *
   * @example
   * ```typescript
   * dispatcher.renderAll();
   * ```
   *
   * @see {@link render}
   */
  renderAll(): void {
    this.cacheCoordinator.renderAll(this.entityTracker);
  }

  /**
   * Mark entity as visible in a specific view
   *
   * Records that an entity is visible within a particular view or viewport.
   * Used for tracking which entities are visible where.
   *
   * @param viewId - ID of the view where entity is visible
   * @param entityId - ID of the visible entity
   *
   * @example
   * ```typescript
   * dispatcher.markEntityVisible('viewport-main', 'entity-123');
   * ```
   *
   * @see {@link markEntityInvisible}
   * @see {@link isEntityVisibleInView}
   */
  markEntityVisible(viewId: string, entityId: string): void {
    this.entityTracker.markEntityVisible(viewId, entityId);
  }

  /**
   * Mark entity as invisible in a specific view
   *
   * Records that an entity is not visible within a particular view or viewport.
   *
   * @param viewId - ID of the view where entity is invisible
   * @param entityId - ID of the invisible entity
   *
   * @example
   * ```typescript
   * dispatcher.markEntityInvisible('viewport-main', 'entity-123');
   * ```
   *
   * @see {@link markEntityVisible}
   * @see {@link getVisibleEntities}
   */
  markEntityInvisible(viewId: string, entityId: string): void {
    this.entityTracker.markEntityInvisible(viewId, entityId);
  }

  /**
   * Check if entity is visible in a view
   *
   * Determines whether an entity is currently visible in the specified view.
   *
   * @param viewId - ID of the view
   * @param entityId - ID of the entity
   * @returns true if entity is visible in view, false otherwise
   *
   * @example
   * ```typescript
   * if (dispatcher.isEntityVisibleInView('viewport-main', 'entity-123')) {
   *   console.log('Entity is visible');
   * }
   * ```
   *
   * @see {@link getVisibleEntities}
   * @see {@link markEntityVisible}
   */
  isEntityVisibleInView(viewId: string, entityId: string): boolean {
    return this.entityTracker.isEntityVisibleInView(viewId, entityId);
  }

  /**
   * Get all visible entities in a view
   *
   * Returns the set of entity IDs that are currently visible in the specified view.
   *
   * @param viewId - ID of the view
   * @returns Set of visible entity IDs
   *
   * @example
   * ```typescript
   * const visibleEntities = dispatcher.getVisibleEntities('viewport-main');
   * console.log(`Visible entities: ${visibleEntities.size}`);
   * ```
   *
   * @see {@link setViewVisibility}
   * @see {@link markEntityVisible}
   */
  getVisibleEntities(viewId: string): Set<string> {
    return this.entityTracker.getVisibleEntities(viewId);
  }

  /**
   * Set visibility state for all entities in a view
   *
   * Atomically sets which entities are visible in a view.
   * Replaces the previous visibility state for that view.
   *
   * @param viewId - ID of the view
   * @param entityIds - Iterable of entity IDs that should be visible
   *
   * @example
   * ```typescript
   * dispatcher.setViewVisibility('viewport-main', ['entity-1', 'entity-2', 'entity-3']);
   * ```
   *
   * @see {@link getVisibleEntities}
   * @see {@link clearViewVisibility}
   */
  setViewVisibility(viewId: string, entityIds: Iterable<string>): void {
    this.entityTracker.setViewVisibility(viewId, entityIds);
  }

  /**
   * Clear visibility state for a view
   *
   * Removes all visibility tracking for a specific view.
   * Effectively marks all entities as invisible in that view.
   *
   * @param viewId - ID of the view to clear
   *
   * @example
   * ```typescript
   * dispatcher.clearViewVisibility('viewport-main');
   * ```
   *
   * @see {@link setViewVisibility}
   */
  clearViewVisibility(viewId: string): void {
    this.entityTracker.clearViewVisibility(viewId);
  }

  /**
   * Clear visibility state for an entity
   *
   * Removes all visibility tracking for a specific entity across all views.
   *
   * @param entityId - ID of the entity to clear visibility for
   *
   * @example
   * ```typescript
   * dispatcher.clearEntityVisibility('entity-123');
   * ```
   *
   * @see {@link markEntityInvisible}
   */
  clearEntityVisibility(entityId: string): void {
    this.entityTracker.clearEntityVisibility(entityId);
  }

  /**
   * Get all views where an entity is visible
   *
   * Returns the set of view IDs in which the entity is currently visible.
   *
   * @param entityId - ID of the entity
   * @returns Set of view IDs where entity is visible
   *
   * @example
   * ```typescript
   * const views = dispatcher.getViewsForEntity('entity-123');
   * console.log(`Entity visible in ${views.size} views`);
   * ```
   *
   * @see {@link getVisibleEntities}
   */
  getViewsForEntity(entityId: string): Set<string> {
    return this.entityTracker.getViewsForEntity(entityId);
  }

  /**
   * Get performance statistics
   *
   * Retrieves detailed performance statistics including:
   * - Frame timing information
   * - Render operation timings
   * - Memory usage
   * - Cache hit rates
   *
   * @returns Performance statistics object
   *
   * @example
   * ```typescript
   * const stats = dispatcher.getPerformanceStats();
   * console.log(`Average frame time: ${stats.avgFrameTime}ms`);
   * ```
   *
   * @see {@link getRenderStats}
   */
  getPerformanceStats(): ReturnType<RenderMetricsModule["getPerformanceStats"]> {
    return this.cacheCoordinator.getPerformanceStats();
  }

  /**
   * Dispose of the render system
   *
   * Cleans up all resources, disconnects from external systems, unregisters all renderers,
   * and records final lifecycle metrics.
   *
   * After calling dispose(), the dispatcher should not be used.
   * This is typically called during application shutdown.
   *
   * Cleanup Sequence:
   * 1. Detach from render events
   * 2. Reset dirty region tracking
   * 3. Dispose of all registered renderers
   * 4. Unregister all renderers
   * 5. Dispose entity tracker
   * 6. Dispose cache coordinator
   * 7. Record disposal metrics
   *
   * @example
   * ```typescript
   * // When shutting down
   * dispatcher.dispose();
   * dispatcher = null; // Release reference
   * ```
   *
   * @implements {IDisposable}
   */
  dispose(): void {
    const trackedEntities = this.entityTracker.getSize();
    const manager = this.dirtyModule.getManager();
    const dirtyRegionCount = manager.getDirtyRegionCount();
    const dirtyEntityCount = manager.getDirtyEntityCount();
    const pendingFullRedraw = this.dirtyModule.isFullRedrawPending();
    const rendererNames = this.orchestrator.getRegisteredRenderers();

    this.eventBridgeModule.detach();
    manager.resetForFullRedraw();
    for (const rendererName of rendererNames) {
      const renderer = this.orchestrator.getRenderer(rendererName);
      renderer?.dispose?.();
      this.orchestrator.unregisterRenderer(rendererName);
    }

    this.entityTracker.dispose();
    this.cacheCoordinator.dispose();
    this.metrics.recordLifecycle("dispose", {
      tracked_entities: trackedEntities,
      dirty_regions: dirtyRegionCount,
      dirty_entities: dirtyEntityCount,
      pending_full_redraw: pendingFullRedraw,
      renderer_count: rendererNames.length,
    });
    diagnostics.info("RenderManager disposed", {
      trackedEntities,
      dirtyRegionCount,
      dirtyEntityCount,
      pendingFullRedraw,
      rendererNames,
    });

    this.metrics.dispose();
  }

  protected configureStrategySelector(config?: RenderStrategySelectorRuntimeConfig): void {
    this.orchestrator.configureStrategySelector(config);
  }

  protected configureRedrawExecutor(): void {
    this.dirtyModule.attachCanvasArtifactsProvider(() =>
      this.cacheCoordinator.getCanvasArtifacts()
    );
    this.dirtyModule.setRenderExecutor(
      () => this.renderAll(),
      () => this.entityUpdateCallback?.()
    );
  }

  protected scheduleRedraw(trigger?: string): void {
    this.dirtyModule.scheduleRedraw(trigger);
  }

  protected createMetricsDependencies(): RenderMetricsModuleDependencies {
    return {
      getQueueSize: () => this.entityTracker?.getSize?.() ?? 0,
      getDirtyRegionCount: () => this.dirtyModule?.getManager().getDirtyRegionCount() ?? 0,
      getDirtyEntityCount: () => this.dirtyModule?.getManager().getDirtyEntityCount() ?? 0,
      isFullRedrawPending: () => this.dirtyModule?.isFullRedrawPending() ?? false,
      getRenderResultsSize: () => this.entityTracker?.getRenderResultsSize?.() ?? 0,
      getRendererNames: () => this.orchestrator?.getRegisteredRenderers?.() ?? [],
      getDefaultRenderer: () => this.orchestrator?.getDefaultRenderer?.() ?? "none",
    };
  }

  protected recordBackpressure(event: FrameBackpressureEvent): void {
    const attrs: Record<string, string | number | boolean> = {
      queue_size: event.metadata?.queueSize ?? 0,
    };
    if (event.metadata?.deferred !== undefined) attrs.deferred = event.metadata.deferred;
    if (event.metadata?.executed !== undefined) attrs.executed = event.metadata.executed;
    if (event.metadata?.budgetMs !== undefined) attrs.budget_ms = event.metadata.budgetMs;
    if (event.metadata?.frameDurationMs !== undefined)
      attrs.frame_duration_ms = Number(event.metadata.frameDurationMs);
    if (event.metadata?.estimatedQueueDurationMs !== undefined)
      attrs.estimated_queue_ms = Number(event.metadata.estimatedQueueDurationMs);
    this.metrics.recordSchedulerBackpressure(event.reason, attrs);
  }

  protected resolveExternalEntity(entityId: string): IEntity | undefined {
    if (!this.entityManager) {
      return undefined;
    }
    try {
      return (this.entityManager.getEntity?.(entityId)) ?? undefined;
    } catch (error) {
      this.metrics.recordError("entity_lookup_failure");
      diagnostics.warn("Failed to retrieve entity for dirty mark", {
        entityId,
        error,
      });
      return undefined;
    }
  }
}
