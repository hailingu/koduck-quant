/**
 * @file RuntimeDebugConfiguration
 * Provides debug configuration management functionality
 *
 * Responsibilities:
 * - Manage debug option settings and retrieval
 * - Sync debug configuration to Logger
 * - Sync debug configuration to event managers
 *
 * Usage scenario:
 * ```typescript
 * const debugConfig = new RuntimeDebugConfiguration({
 *   eventBus,
 *   renderEvents,
 *   entityEvents
 * });
 *
 * debugConfig.configureDebug({
 *   enabled: true,
 *   logLevel: 'debug',
 *   eventTracking: true
 * });
 *
 * const options = debugConfig.getDebugOptions();
 * ```
 *
 * @module RuntimeDebugConfiguration
 * @since Phase 2.5
 */

import { logger } from "../logger";
import type { LogConfig } from "../logger";
import type { DebugOptions } from "./debug-options";
import type { EventBus } from "../event/event-bus";
import type { RenderEventManager } from "../event/render-event-manager";
import type { EntityEventManager } from "../event/entity-event-manager";
import type { IEntity } from "../entity/";

/**
 * Event manager collection interface
 */
interface EventManagers {
  /** Event bus */
  eventBus: EventBus;
  /** Render event manager */
  renderEvents: RenderEventManager;
  /** Entity event manager */
  entityEvents: EntityEventManager<IEntity>;
}

/**
 * RuntimeDebugConfiguration class
 * Responsible for debug configuration management and synchronization
 *
 * @example
 * ```typescript
 * const debugConfig = new RuntimeDebugConfiguration({
 *   eventBus: myEventBus,
 *   renderEvents: myRenderEvents,
 *   entityEvents: myEntityEvents
 * });
 *
 * // Configure debug options
 * debugConfig.configureDebug({
 *   enabled: true,
 *   logLevel: 'debug',
 *   eventTracking: true,
 *   includeEmoji: true,
 *   panel: { position: 'bottom' }
 * });
 *
 * // Get current debug options
 * const options = debugConfig.getDebugOptions();
 * ```
 */
export class RuntimeDebugConfiguration {
  /**
   * Current debug options
   * @private
   */
  private debugOptions: DebugOptions | undefined;

  /**
   * Event manager collection
   * @private
   */
  private readonly eventManagers: EventManagers;

  /**
   * Create RuntimeDebugConfiguration instance
   *
   * @param eventManagers - Event manager collection object
   * @param eventManagers.eventBus - Event bus
   * @param eventManagers.renderEvents - Render event manager
   * @param eventManagers.entityEvents - Entity event manager
   *
   * @example
   * ```typescript
   * const debugConfig = new RuntimeDebugConfiguration({
   *   eventBus: new EventBus(),
   *   renderEvents: new RenderEventManager(),
   *   entityEvents: new EntityEventManager()
   * });
   * ```
   */
  constructor(eventManagers: EventManagers) {
    this.eventManagers = eventManagers;
  }

  /**
   * Configure debug options
   *
   * This method will:
   * 1. Clone and store debug options (deep clone panel object)
   * 2. Sync configuration to Logger
   * 3. Sync configuration to event managers
   *
   * @param options - Debug options, clears debug configuration if undefined
   *
   * @example
   * ```typescript
   * // Enable debugging
   * debugConfig.configureDebug({
   *   enabled: true,
   *   logLevel: 'debug',
   *   eventTracking: true
   * });
   *
   * // Clear debug configuration
   * debugConfig.configureDebug();
   * ```
   */
  configureDebug(options?: DebugOptions): void {
    // Clone and store debug options
    const snapshot = options ? this.cloneDebugOptions(options) : undefined;
    this.debugOptions = snapshot;

    // Sync to Logger
    this.syncToLogger(options);

    // Sync to event managers
    const eventDebugEnabled = Boolean(options?.eventTracking);
    this.syncToEventManagers(eventDebugEnabled);
  }

  /**
   * Get current debug options
   *
   * Returns a deep clone of debug options to prevent external modification of internal state
   *
   * @returns Clone of debug options, undefined if not configured
   *
   * @example
   * ```typescript
   * const options = debugConfig.getDebugOptions();
   * if (options) {
   *   console.log('Debug enabled:', options.enabled);
   *   console.log('Log level:', options.logLevel);
   * }
   * ```
   */
  getDebugOptions(): DebugOptions | undefined {
    if (!this.debugOptions) {
      return undefined;
    }
    return this.cloneDebugOptions(this.debugOptions);
  }

  /**
   * Sync debug configuration to Logger
   *
   * Update Logger configuration based on DebugOptions settings
   *
   * @param options - Debug options
   * @private
   *
   * @example
   * ```typescript
   * // Internal call example
   * this.syncToLogger({
   *   enabled: true,
   *   logLevel: 'debug',
   *   includeEmoji: true
   * });
   * ```
   */
  private syncToLogger(options?: DebugOptions): void {
    const logConfig: Partial<LogConfig> = {};

    if (options?.enabled !== undefined) {
      logConfig.enabled = options.enabled;
    }
    if (options?.logLevel) {
      logConfig.level = options.logLevel;
    }
    if (options?.includeEmoji !== undefined) {
      logConfig.includeEmoji = options.includeEmoji;
    }

    if (Object.keys(logConfig).length > 0) {
      logger.setConfig(logConfig);
    }
  }

  /**
   * Sync debug configuration to event managers
   *
   * Enable or disable debug mode for event bus, render event manager, and entity event manager
   *
   * @param enabled - Whether to enable event debugging
   * @private
   *
   * @example
   * ```typescript
   * // Internal call example
   * this.syncToEventManagers(true); // Enable event debugging
   * this.syncToEventManagers(false); // Disable event debugging
   * ```
   */
  private syncToEventManagers(enabled: boolean): void {
    this.eventManagers.eventBus.setDebugMode(enabled);
    this.eventManagers.renderEvents.setDebugMode?.(enabled);
    this.eventManagers.entityEvents.setDebugMode(enabled);
  }

  /**
   * Deep clone debug options
   *
   * Create a deep clone of DebugOptions, specially handling the panel object
   *
   * @param options - Debug options to clone
   * @returns Deep clone of debug options
   * @private
   *
   * @example
   * ```typescript
   * // Internal call example
   * const clone = this.cloneDebugOptions({
   *   enabled: true,
   *   panel: { position: 'bottom', width: 300 }
   * });
   * ```
   */
  private cloneDebugOptions(options: DebugOptions): DebugOptions {
    const clone: DebugOptions = { ...options };
    if (options.panel) {
      clone.panel = { ...options.panel };
    } else {
      delete (clone as { panel?: DebugOptions["panel"] }).panel;
    }
    return clone;
  }
}
