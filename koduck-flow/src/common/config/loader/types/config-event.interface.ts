/**
 * Configuration Event System
 *
 * Provides event-driven mechanism for configuration changes,
 * enabling decoupled communication between config modules.
 */

import type { DuckFlowConfig } from "../../schema";
import type { ConfigChangeContext } from "../types";

/**
 * Configuration reload event
 */
export interface ConfigReloadEvent {
  /**
   * Partial configuration options to apply
   */
  options?: Partial<DuckFlowConfig>;

  /**
   * Context information about the reload trigger
   */
  context?: ConfigChangeContext;
}

/**
 * Configuration event listener
 */
export type ConfigEventListener = (event: ConfigReloadEvent) => void;

/**
 * Configuration event emitter interface
 *
 * Enables publish-subscribe pattern for configuration events
 */
export interface IConfigEventEmitter {
  /**
   * Subscribe to configuration reload events
   */
  on(event: "reload", listener: ConfigEventListener): void;

  /**
   * Unsubscribe from configuration reload events
   */
  off(event: "reload", listener: ConfigEventListener): void;

  /**
   * Emit a configuration reload event
   */
  emit(event: "reload", data: ConfigReloadEvent): void;
}
