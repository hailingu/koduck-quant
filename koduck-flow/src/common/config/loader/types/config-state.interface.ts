/**
 * Config state management interface
 * Used to centralize config state management and decouple state dependencies between modules
 */

import type { KoduckFlowConfig } from "../../schema.js";

/**
 * Config change listener type
 */
export type ConfigChangeListener = (config: KoduckFlowConfig, previousConfig: KoduckFlowConfig) => void;

/**
 * Config state manager interface
 * Provides read/write, subscription, and history tracking for config state
 */
export interface IConfigState {
  /**
   * Get current config state
   * @returns Current config object
   */
  getCurrentConfig(): KoduckFlowConfig;

  /**
   * Set config state
   * @param config - New config object
   * @param silent - Whether to update silently (without triggering listeners)
   */
  setCurrentConfig(config: KoduckFlowConfig, silent?: boolean): void;

  /**
   * Get previous config state
   * @returns Previous config object, or undefined if not available
   */
  getPreviousConfig(): KoduckFlowConfig | undefined;

  /**
   * Subscribe to config change events
   * @param listener - Config change listener
   * @returns Unsubscribe function
   */
  subscribe(listener: ConfigChangeListener): () => void;

  /**
   * Unsubscribe from config change events
   * @param listener - Listener to unsubscribe
   */
  unsubscribe(listener: ConfigChangeListener): void;

  /**
   * Get all listeners
   * @returns All currently registered listeners
   */
  getListeners(): ReadonlyArray<ConfigChangeListener>;

  /**
   * Clear all listeners
   */
  clearListeners(): void;

  /**
   * Get config history
   * @param limit - Limit on the number of history entries to return
   * @returns Config history array
   */
  getHistory(limit?: number): ReadonlyArray<{
    config: KoduckFlowConfig;
    timestamp: number;
    trigger?: string;
  }>;

  /**
   * Clear config history
   */
  clearHistory(): void;
}
