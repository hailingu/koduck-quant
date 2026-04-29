/**
 * Koduck Flow System-level Event Bus
 *
 * Manages system-level events uniformly, including logging and system events.
 * Extends EventManager base class, can be instantiated on demand, also provides a default instance.
 */

import { BaseEvent, GenericEvent } from "./event";
import { EventManager } from "./event-manager";

/**
 * Log event interface
 */
interface LogEvent {
  /** Log level */
  level: "debug" | "info" | "warn" | "error" | "fatal";
  /** Log message */
  message: string;
  /** Error object (if any) */
  error?: Error | undefined;
  /** Context information */
  context?: Record<string, unknown> | undefined;
  /** Timestamp */
  timestamp: number;
  /** Source module */
  source?: string | undefined;
}

/**
 * System event interface
 */
interface SystemEvent {
  /** Event type */
  type: "startup" | "shutdown" | "error" | "warning" | "config-change";
  /** Event data */
  data: unknown;
  /** Timestamp */
  timestamp: number;
  /** Event source */
  source: string;
}

/**
 * Log event
 *
 * Dedicated for log data collection and distribution
 */
class LoggingEvent extends BaseEvent<LogEvent> {
  constructor() {
    super("LoggingEvent", {
      enableBatching: true,
      batchSize: 50,
      batchInterval: 500, // 500ms batch processing for logs
    });
  }

  /**
   * Record debug log
   */
  debug(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log("debug", message, undefined, context, source);
  }

  /**
   * Record info log
   */
  info(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log("info", message, undefined, context, source);
  }

  /**
   * Record warning log
   */
  warn(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log("warn", message, undefined, context, source);
  }

  /**
   * Record error log
   */
  error(message: string, error?: Error, context?: Record<string, unknown>, source?: string): void {
    this.log("error", message, error, context, source);
  }

  /**
   * Record fatal error log
   */
  fatal(message: string, error?: Error, context?: Record<string, unknown>, source?: string): void {
    this.log("fatal", message, error, context, source);
  }

  /**
   * Generic logging method
   */
  private log(
    level: LogEvent["level"],
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
    source?: string
  ): void {
    const logEvent: LogEvent = {
      level,
      message,
      error,
      context,
      timestamp: Date.now(),
      source,
    };

    this.fire(logEvent);
  }
}

/**
 * System event bus
 *
 * Dedicated for system-level event management
 */
class SystemEventBus extends BaseEvent<SystemEvent> {
  constructor() {
    super("SystemEvent", {
      enableBatching: false, // System events need immediate processing
    });
  }

  /**
   * System startup event
   */
  startup(data: unknown, source: string): void {
    this.fire({
      type: "startup",
      data,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * System shutdown event
   */
  shutdown(data: unknown, source: string): void {
    this.fire({
      type: "shutdown",
      data,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * System error event
   */
  systemError(data: unknown, source: string): void {
    this.fire({
      type: "error",
      data,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * System warning event
   */
  systemWarning(data: unknown, source: string): void {
    this.fire({
      type: "warning",
      data,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * Configuration change event
   */
  configChange(data: unknown, source: string): void {
    this.fire({
      type: "config-change",
      data,
      timestamp: Date.now(),
      source,
    });
  }
}

/**
 * System-level event bus
 *
 * Extends EventManager base class, manages system-level events uniformly
 * Provides a reusable default instance, also supports creating independent instances on demand
 */
class EventBus extends EventManager {
  /** Log event instance */
  public readonly logging = new LoggingEvent();

  /** System event instance */
  public readonly system = new SystemEventBus();

  /** Custom event map */
  private readonly customEvents = new Map<string, BaseEvent<unknown>>();

  constructor() {
    super();
  }

  /**
   * Override base class method: set debug mode for all system events
   */
  override setDebugMode(enabled: boolean): this {
    this.logging.setDebugMode(enabled);
    this.system.setDebugMode(enabled);
    this.customEvents.forEach((event) => event.setDebugMode(enabled));
    return this;
  }

  /**
   * Override base class method: configure all system events
   */
  override configureAll(config: Partial<import("./event").EventConfiguration>): this {
    this.logging.updateConfiguration(config);
    this.system.updateConfiguration(config);
    this.customEvents.forEach((event) => event.updateConfiguration(config));
    return this;
  }

  /**
   * Override base class method: force process all system event batches
   */
  override flushAllBatches(): void {
    this.logging.flushBatch();
    this.system.flushBatch();
    this.customEvents.forEach((event) => event.flushBatch());
  }

  /**
   * Override base class method: clear all system event listeners
   */
  override clearAll(): void {
    this.logging.clear();
    this.system.clear();
    this.customEvents.forEach((event) => event.clear());
  }

  /**
   * Override base class method: get all system event statistics
   * Note: Statistics feature removed as required
   */
  getAllStats(): Record<string, unknown> {
    return {
      managerType: this.constructor.name,
      timestamp: Date.now(),
      message: "Statistics feature removed",
    };
  }

  /**
   * Override base class method: reset all system events
   */
  override resetAll(): void {
    this.logging.reset();
    this.system.reset();
    this.customEvents.forEach((event) => event.reset());
  }

  /**
   * Override base class method: clean up all system event resources
   */
  override dispose(): void {
    this.logging.dispose();
    this.system.dispose();
    this.customEvents.forEach((event) => event.dispose());
    this.customEvents.clear();
  }

  // ===== EventBus specific methods =====

  /**
   * Register custom event
   * @param eventName Event name
   * @param event Event instance
   */
  registerEvent<T>(eventName: string, event: BaseEvent<T>): void {
    this.customEvents.set(eventName, event as BaseEvent<unknown>);
  }

  /**
   * Unregister custom event and clean up its resources
   * @param eventName Event name
   * @returns Whether unregistered successfully
   */
  unregisterEvent(eventName: string): boolean {
    const event = this.customEvents.get(eventName);
    if (!event) return false;
    try {
      // Release event listeners and timers
      event.dispose();
    } finally {
      this.customEvents.delete(eventName);
    }
    return true;
  }

  /**
   * Get custom event
   * @param eventName Event name
   */
  getEvent<T>(eventName: string): BaseEvent<T> | undefined {
    return this.customEvents.get(eventName) as BaseEvent<T> | undefined;
  }

  /**
   * Generic event listener registration (compatibility method)
   * @param eventName Event name
   * @param listener Listener function
   */
  on<T>(eventName: string, listener: (payload: T) => void): () => void {
    let event = this.customEvents.get(eventName) as BaseEvent<T>;
    if (!event) {
      // Auto-create event
      event = new GenericEvent<T>(eventName);
      this.customEvents.set(eventName, event as BaseEvent<unknown>);
    }
    return event.addEventListener(listener);
  }

  /**
   * Unregister event listener (compatibility method)
   * @param eventName Event name
   * @param listener Listener function
   */
  off<T>(eventName: string, listener: (payload: T) => void): boolean {
    const event = this.customEvents.get(eventName) as BaseEvent<T>;
    return event ? event.removeEventListener(listener) : false;
  }

  /**
   * Emit event (compatibility method)
   * @param eventName Event name
   * @param payload Event data
   */
  emit<T>(eventName: string, payload: T): void {
    const event = this.customEvents.get(eventName) as BaseEvent<T>;
    if (event) {
      event.fire(payload);
    }
  }
}

// Export unified event system
export { EventBus, LoggingEvent, SystemEventBus, type LogEvent, type SystemEvent };

export function createEventBus(): EventBus {
  return new EventBus();
}
