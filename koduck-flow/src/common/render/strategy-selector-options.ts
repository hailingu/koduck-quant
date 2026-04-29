/**
 * RenderStrategySelector configurable options.
 */
export interface RenderStrategySelectorOptions {
  /** Allow overriding strategies with the same name */
  allowOverride?: boolean;
  /** Custom log tag */
  loggerTag?: string;
  /** Whether the default strategy order after registration is sorted by priority in descending order (default true) */
  autoSort?: boolean;
}
