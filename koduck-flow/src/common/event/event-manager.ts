/**
 * Koduck Flow Event Manager Base Class
 *
 * Provides common event management functionality as a base class for other event managers.
 * Not a singleton, can be inherited and extended into different types of event managers.
 *
 * @example
 * ```typescript
 * class CustomEventManager extends EventManager {
 *   // Custom implementation
 * }
 * ```
 */
import { type EventConfiguration } from "./event";
import {
  EntityAddEvent,
  EntityRemoveEvent,
  EntityUpdateEvent,
} from "./entity-event";

/**
 * Event manager base class
 *
 * Provides generic event management functionality, including debug mode, batch configuration, etc.
 * Serves as the base class for other concrete event managers, supporting inheritance and extension.
 *
 * @since 1.0.0
 */
export class EventManager<T = unknown> {
  /** Entity add event */
  public readonly added = new EntityAddEvent<T>();

  /** Entity remove event */
  public readonly removed = new EntityRemoveEvent<T>();

  /** Entity update event */
  public readonly updated = new EntityUpdateEvent<T>();

  /**
   * Set debug mode for all managed events
   */
  setDebugMode(enabled: boolean): this {
    this.added.setDebugMode(enabled);
    this.removed.setDebugMode(enabled);
    this.updated.setDebugMode(enabled);
    return this;
  }

  /**
   * Configure all events at once
   */
  configureAll(config: Partial<EventConfiguration>): this {
    this.added.updateConfiguration(config);
    this.removed.updateConfiguration(config);
    this.updated.updateConfiguration(config);
    return this;
  }

  /**
   * Configure batch processing for all events
   */
  configureBatch(
    config: Partial<
      Pick<EventConfiguration, "batchSize" | "batchInterval" | "enableBatching">
    >
  ): this {
    return this.configureAll(config);
  }

  /**
   * Force process all batches
   */
  flushAllBatches(): void {
    this.added.flushBatch();
    this.removed.flushBatch();
    this.updated.flushBatch();
  }

  /**
   * Clear all event listeners
   */
  clearAll(): void {
    this.added.clear();
    this.removed.clear();
    this.updated.clear();
  }

  /**
   * Reset all events
   */
  resetAll(): void {
    this.added.reset();
    this.removed.reset();
    this.updated.reset();
  }

  /**
   * Conditional execution - only execute callback when condition is met
   */
  when(condition: boolean, callback: (manager: this) => void): this {
    if (condition) {
      callback(this);
    }
    return this;
  }

  /**
   * Destructor - clean up all resources
   */
  dispose(): void {
    this.added.dispose();
    this.removed.dispose();
    this.updated.dispose();
  }
}
