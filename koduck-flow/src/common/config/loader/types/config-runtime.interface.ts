/**
 * Runtime config management interface
 * Used to manage runtime config overrides and dynamic config updates
 */

import type { KoduckFlowConfig } from "../../schema.js";

/**
 * Runtime config manager interface
 * Manages runtime config overrides, persistence, and merge logic
 */
export interface IConfigRuntime {
  /**
   * Apply runtime config overrides
   * @param overrides - Config override object to apply
   * @param persist - Whether to persist override config
   * @returns Full config after applying overrides
   */
  applyOverrides(overrides: Partial<KoduckFlowConfig>, persist?: boolean): Promise<KoduckFlowConfig>;

  /**
   * Get current runtime override config
   * @returns Current runtime override config
   */
  getOverrides(): Partial<KoduckFlowConfig>;

  /**
   * Clear runtime override config
   * @param persist - Whether to also clear persisted override config
   * @returns Config after clearing
   */
  clearOverrides(persist?: boolean): Promise<KoduckFlowConfig>;

  /**
   * Merge multiple config objects
   * @param configs - Array of config objects to merge, ordered from low to high priority
   * @returns Merged config object
   */
  merge(...configs: Array<Partial<KoduckFlowConfig>>): KoduckFlowConfig;

  /**
   * Load override config from persistent storage
   * @returns Loaded override config
   */
  loadPersistedOverrides(): Promise<Partial<KoduckFlowConfig>>;

  /**
   * Save override config to persistent storage
   * @param overrides - Override config to save
   */
  saveOverrides(overrides: Partial<KoduckFlowConfig>): Promise<void>;
}
