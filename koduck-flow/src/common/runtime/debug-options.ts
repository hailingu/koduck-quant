/**
 * @module src/common/runtime/debug-options
 * @description Runtime debug configuration options and types.
 * Provides configuration for debug tooling, logging levels, event tracking, and debug UI panel.
 * @example
 * ```typescript
 * const options: DebugOptions = {
 *   enabled: true,
 *   logLevel: 'debug',
 *   eventTracking: true,
 *   panel: { enabled: true, position: 'right' }
 * };
 * runtime.configureDebug(options);
 * ```
 */

import type { LogLevel } from "../logger";

/**
 * Debug UI panel position configuration
 * @typedef {string} DebugPanelPosition
 */
export type DebugPanelPosition = "left" | "right" | "bottom";

/**
 *
 */
export interface DebugPanelOptions {
  /** Whether the debug panel UI should be rendered at all. */
  enabled?: boolean | undefined;
  /** Initial open state when the component mounts. */
  defaultOpen?: boolean | undefined;
  /** Preferred docking position. */
  position?: DebugPanelPosition | undefined;
}

/**
 *
 */
export interface DebugOptions {
  /** Enable the runtime wide debug tooling. */
  enabled?: boolean | undefined;
  /** Override logger log level. */
  logLevel?: LogLevel | undefined;
  /** Toggle emoji output for structured logs. */
  includeEmoji?: boolean | undefined;
  /** Enable verbose event tracking (Entity/Render events). */
  eventTracking?: boolean | undefined;
  /** UI debug panel configuration. */
  panel?: DebugPanelOptions | undefined;
}

export const DEFAULT_DEBUG_OPTIONS: Required<DebugOptions> = {
  enabled: false,
  logLevel: "warn",
  includeEmoji: false,
  eventTracking: false,
  panel: {
    enabled: false,
    defaultOpen: false,
    position: "right",
  },
};

/**
 *mergeDebugOptions
 * @param base
 * @param overrides
 */
export function mergeDebugOptions(
  base: DebugOptions | undefined,
  overrides: DebugOptions | undefined
): DebugOptions | undefined {
  if (!base && !overrides) return undefined;
  if (!base) return overrides ? { ...overrides } : undefined;
  if (!overrides) return { ...base };

  return {
    ...base,
    ...overrides,
    panel: {
      ...base.panel,
      ...overrides.panel,
    },
  };
}
