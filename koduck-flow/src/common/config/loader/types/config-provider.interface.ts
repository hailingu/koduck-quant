/**
 * Config provider interface
 * Provides a unified abstraction layer for config access and management
 */

import type { KoduckFlowConfig } from "../../schema.js";

/**
 * Config provider interface
 * Used to decouple the config loader from specific implementation dependencies
 */
export interface IConfigProvider {
  /**
   * Get the full configuration object
   * @returns Current configuration object
   */
  getConfig(): KoduckFlowConfig;

  /**
   * Get config value at the specified path
   * @param path - Config path using dot notation, e.g., 'render.mode'
   * @returns Config value, or undefined if not present
   */
  get<T = unknown>(path: string): T | undefined;

  /**
   * Set config value at the specified path
   * @param path - Config path
   * @param value - Config value
   */
  set(path: string, value: unknown): void;

  /**
   * Check if config path exists
   * @param path - Config path
   * @returns Whether it exists
   */
  has(path: string): boolean;

  /**
   * Validate config object against schema
   * @param config - Config object to validate
   * @returns Validation result
   */
  validate(config: KoduckFlowConfig): import("../../schema.js").ValidationResult;

  /**
   * Reload configuration
   * @param options - Optional runtime override config
   * @param context - Config change context
   * @returns Reloaded configuration object
   */
  reload(options?: Partial<KoduckFlowConfig>, context?: unknown): KoduckFlowConfig;
}
