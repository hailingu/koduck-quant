/**
 * Render Dispatcher Façade Layer
 *
 * This module provides the public API for the rendering system through two main classes:
 * - `RenderDispatcher`: Thin façade extending the core rendering infrastructure
 * - `RenderManager`: Alias for `RenderDispatcher` (for backward compatibility)
 *
 * Architecture Overview:
 * The rendering system uses a façade pattern to provide a clean public interface while
 * keeping complex internal logic in `RenderDispatcherCore`. This separation allows:
 * - Clean separation of concerns (public API vs. internal implementation)
 * - Easy testing through alternative facades
 * - Future evolution without breaking public API
 *
 * Key Components:
 * 1. `RenderDispatcher` - Main façade class extending `RenderDispatcherCore`
 * 2. `RenderManager` - Alias for backward compatibility
 * 3. Factory functions - `createRenderDispatcher()` and `createRenderManager()`
 *
 * Dependency Injection:
 * All render subsystem dependencies are injected through `RenderManagerDependencies`:
 * - renderEvents: Event management for render lifecycle
 * - registryManager (optional): Entity registry
 * - entityManager (optional): Entity lifecycle management
 * - frameScheduler (optional): Frame scheduling and backpressure handling
 *
 * Usage Pattern:
 * The typical usage flow is:
 * 1. Create dependencies implementing `RenderManagerDependencies`
 * 2. Use factory function to create dispatcher: `createRenderDispatcher(deps)`
 * 3. Use dispatcher to manage rendering operations
 * 4. Call `dispose()` when done to clean up resources
 *
 * Design Pattern: Façade Pattern + Factory Pattern
 * - Façade Pattern: `RenderDispatcher` simplifies interaction with complex subsystems
 * - Factory Pattern: Factory functions encapsulate instance creation logic
 *
 * @module render/dispatcher
 * @see {@link RenderDispatcherCore} for core implementation details
 * @see {@link RenderManagerDependencies} for dependency requirements
 *
 * @example
 * ```typescript
 * import { createRenderDispatcher } from '@/render/render-manager';
 * import type { RenderManagerDependencies } from '@/render/render-manager';
 *
 * // Create dependencies
 * const deps: RenderManagerDependencies = {
 *   renderEvents: eventManager,
 *   registryManager: registry,
 *   entityManager: entities,
 *   frameScheduler: scheduler,
 * };
 *
 * // Create dispatcher
 * const dispatcher = createRenderDispatcher(deps);
 *
 * // Use dispatcher for rendering
 * await dispatcher.render(container, renderConfig);
 *
 * // Clean up
 * dispatcher.dispose();
 * ```
 */

import type { RenderManagerDependencies } from "./types";
import { RenderDispatcherCore } from "./dispatcher-core";

/**
 * Render Dispatcher - Main Façade Class
 *
 * Provides the primary public API for rendering operations by extending `RenderDispatcherCore`.
 * This class acts as a thin wrapper around the core implementation, ensuring a clean separation
 * between public interface and internal complexity.
 *
 * Responsibilities:
 * - Delegate rendering operations to the core infrastructure
 * - Inherit all rendering capabilities from `RenderDispatcherCore`
 * - Maintain backward compatibility with existing code
 *
 * For detailed API documentation, see the parent class `RenderDispatcherCore`.
 *
 * @class RenderDispatcher
 * @augments {RenderDispatcherCore}
 *
 * @example
 * ```typescript
 * // Direct instantiation (less common, prefer factory function)
 * const dispatcher = new RenderDispatcher({
 *   renderEvents: eventManager,
 * });
 *
 * // Using factory is recommended
 * const dispatcher = createRenderDispatcher({ renderEvents: eventManager });
 * ```
 *
 * @see {@link createRenderDispatcher} for factory function
 * @see {@link RenderDispatcherCore} for inherited API
 */
export class RenderDispatcher extends RenderDispatcherCore {
  /**
   * Constructor
   *
   * Initializes the RenderDispatcher with required dependencies.
   * All dependency resolution and subsystem initialization is delegated to `RenderDispatcherCore`.
   *
   * @param deps - Render manager dependencies containing event managers and optional subsystems
   * - `renderEvents` (required): Event manager for render lifecycle events
   * - `registryManager` (optional): Entity registry for entity lookups
   * - `entityManager` (optional): Entity lifecycle management
   * - `frameScheduler` (optional): Frame scheduling; defaults to new `RenderFrameScheduler()` if omitted
   *
   * @throws {TypeError} If required dependencies are missing
   *
   * @example
   * ```typescript
   * // Create dispatcher with minimal dependencies
   * const dispatcher = new RenderDispatcher({
   *   renderEvents: myEventManager,
   * });
   *
   * // Create dispatcher with all dependencies
   * const dispatcher = new RenderDispatcher({
   *   renderEvents: eventMgr,
   *   registryManager: registry,
   *   entityManager: entities,
   *   frameScheduler: scheduler,
   * });
   * ```
   */
  constructor(deps: RenderManagerDependencies) {
    super(deps);
  }
}

/**
 * Render Manager - Backward Compatibility Alias
 *
 * Alias class that extends `RenderDispatcher` for backward compatibility.
 * In the original architecture, `RenderManager` was the primary class name.
 * This class maintains that naming convention while delegating to `RenderDispatcher`.
 *
 * All functionality is inherited from `RenderDispatcher` (and transitively from `RenderDispatcherCore`).
 * Use `RenderDispatcher` for new code; use `RenderManager` only if required for compatibility.
 *
 * @class RenderManager
 * @augments RenderDispatcher
 *
 * @example
 * ```typescript
 * // Legacy code using RenderManager
 * const manager = new RenderManager({ renderEvents: eventMgr });
 *
 * // Equivalent to
 * const dispatcher = new RenderDispatcher({ renderEvents: eventMgr });
 * ```
 *
 * @deprecated Prefer `RenderDispatcher` for new code
 * @see {@link RenderDispatcher} for primary API
 */
export class RenderManager extends RenderDispatcher {}

/**
 * Factory function to create a RenderDispatcher instance
 *
 * Creates and returns a new `RenderDispatcher` instance with the provided dependencies.
 * This factory function is the recommended way to create dispatcher instances, as it:
 * - Encapsulates the instantiation logic
 * - Makes testing easier (can be mocked or stubbed)
 * - Allows for future extensions (e.g., object pooling, singleton patterns)
 *
 * @param deps - Render manager dependencies
 * @returns A new RenderDispatcher instance configured with the provided dependencies
 *
 * @throws {TypeError} If required dependencies are missing
 *
 * @example
 * ```typescript
 * import { createRenderDispatcher } from '@/render/render-manager';
 *
 * // Create with required dependencies
 * const dispatcher = createRenderDispatcher({
 *   renderEvents: eventManager,
 * });
 *
 * // Create with all dependencies
 * const dispatcher = createRenderDispatcher({
 *   renderEvents: eventManager,
 *   registryManager: registry,
 *   entityManager: entities,
 *   frameScheduler: scheduler,
 * });
 *
 * // Use dispatcher for rendering
 * const result = await dispatcher.render(container, config);
 *
 * // Clean up when done
 * dispatcher.dispose();
 * ```
 *
 * @see {@link RenderDispatcher} for the created class
 * @see {@link RenderManagerDependencies} for dependency interface
 */
export function createRenderDispatcher(deps: RenderManagerDependencies): RenderDispatcher {
  return new RenderDispatcher(deps);
}

export type { RenderStrategy, RenderResult } from "../types";
export { RenderDispatcherCore };

/**
 * Factory function to create a RenderManager instance
 *
 * Creates and returns a new `RenderManager` instance with the provided dependencies.
 * This is an alias for `createRenderDispatcher()` provided for backward compatibility.
 *
 * Recommended: Use `createRenderDispatcher()` for new code.
 * Use this function only if required for compatibility with legacy code.
 *
 * @param deps - Render manager dependencies
 * @returns A new RenderManager instance configured with the provided dependencies
 *
 * @throws {TypeError} If required dependencies are missing
 *
 * @example
 * ```typescript
 * // Legacy code
 * const manager = createRenderManager({ renderEvents: eventMgr });
 *
 * // Equivalent to
 * const dispatcher = createRenderDispatcher({ renderEvents: eventMgr });
 * ```
 *
 * @deprecated Prefer `createRenderDispatcher()` for new code
 * @see {@link createRenderDispatcher} for primary factory function
 * @see {@link RenderManager} for the created class
 */
export function createRenderManager(deps: RenderManagerDependencies): RenderManager {
  return new RenderManager(deps);
}
