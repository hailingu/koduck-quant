/**
 * Configuration Runtime Override Interface
 *
 * Provides abstraction for runtime configuration override operations
 */

import type { KoduckFlowConfig } from "../../schema";
import type { RuntimeOverrideOptions, RuntimeOverrideResult } from "../types";

/**
 * Configuration runtime override interface
 *
 * Enables http-server to apply runtime overrides without
 * direct dependency on ConfigLoader
 */
export interface IConfigRuntimeOverride {
  /**
   * Apply runtime configuration overrides
   *
   * @param overrides - Partial configuration to override
   * @param options - Override options (source, actor, metadata, etc.)
   * @returns Result of the override operation
   */
  applyRuntimeOverrides(
    overrides: Partial<KoduckFlowConfig>,
    options?: RuntimeOverrideOptions
  ): RuntimeOverrideResult;
}
