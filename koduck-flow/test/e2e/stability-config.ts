/**
 * Duck Flow E2E Stability Test Configuration
 *
 * Provides configurable parameters for long-running stability tests via environment variables.
 * Supports different modes (quick, standard, extended) for CI and nightly runs.
 *
 * Environment Variables (all optional with sensible defaults):
 * - PW_STABILITY_MODE: 'quick' | 'standard' | 'extended' | 'custom' (default: 'standard')
 * - PW_STABILITY_DURATION: Duration in milliseconds (overrides mode default)
 * - PW_STABILITY_ITERATIONS: Number of iterations (overrides mode default)
 * - PW_STABILITY_INTERVAL: Check interval in milliseconds (default: 30000ms)
 * - PW_STABILITY_SWITCH_INTERVAL: Tenant switch interval in milliseconds (default: 60000ms)
 * - PW_STABILITY_CHECK_INTERVAL: WebSocket check interval in milliseconds (default: 10000ms)
 *
 * @example
 * // Use defaults (standard mode, ~5 minutes)
 * pnpm test:e2e:core
 *
 * @example
 * // Quick mode for CI (~1 minute)
 * PW_STABILITY_MODE=quick pnpm test:e2e:core
 *
 * @example
 * // Extended mode for nightly (~24 hours or custom duration)
 * PW_STABILITY_MODE=extended pnpm test:e2e:core
 *
 * @example
 * // Custom duration (10 minutes)
 * PW_STABILITY_DURATION=600000 pnpm test:e2e:core
 *
 * @example
 * // Custom iterations (100 iterations with 10-second intervals)
 * PW_STABILITY_ITERATIONS=100 PW_STABILITY_INTERVAL=10000 pnpm test:e2e:core
 */

/**
 * Stability test mode configuration
 */
export type StabilityMode = "quick" | "standard" | "extended" | "custom";

/**
 * Stability test configuration object
 */
export interface StabilityConfig {
  /** Test mode */
  mode: StabilityMode;
  /** Total test duration in milliseconds */
  duration: number;
  /** Number of iterations (derived from duration and interval) */
  iterations: number;
  /** Interval between stability checks in milliseconds */
  interval: number;
  /** Tenant switch interval in milliseconds */
  switchInterval: number;
  /** WebSocket check interval in milliseconds */
  checkInterval: number;
  /** Whether memory profiling is enabled */
  enableMemoryProfiling: boolean;
  /** Whether to log detailed iteration metrics */
  verboseLogging: boolean;
  /** Description of the configuration */
  description: string;
}

/**
 * Default configurations for each stability mode
 */
const MODE_DEFAULTS: Record<StabilityMode, Partial<StabilityConfig>> = {
  quick: {
    duration: 60 * 1000, // 1 minute
    interval: 10 * 1000, // 10-second checks
    switchInterval: 30 * 1000, // 30-second switches
    checkInterval: 5 * 1000, // 5-second WebSocket checks
    enableMemoryProfiling: false,
    verboseLogging: false,
    description: "Quick mode for PR CI (~1 minute)",
  },
  standard: {
    duration: 5 * 60 * 1000, // 5 minutes
    interval: 30 * 1000, // 30-second checks
    switchInterval: 60 * 1000, // 1-minute switches
    checkInterval: 10 * 1000, // 10-second WebSocket checks
    enableMemoryProfiling: true,
    verboseLogging: true,
    description: "Standard mode for local development (~5 minutes)",
  },
  extended: {
    duration: 24 * 60 * 60 * 1000, // 24 hours
    interval: 5 * 60 * 1000, // 5-minute checks
    switchInterval: 30 * 60 * 1000, // 30-minute switches
    checkInterval: 60 * 1000, // 1-minute WebSocket checks
    enableMemoryProfiling: true,
    verboseLogging: false,
    description: "Extended mode for nightly CI (~24 hours)",
  },
  custom: {
    // Will be overridden by environment variables
    duration: 5 * 60 * 1000,
    interval: 30 * 1000,
    switchInterval: 60 * 1000,
    checkInterval: 10 * 1000,
    enableMemoryProfiling: true,
    verboseLogging: true,
    description: "Custom mode configured via environment variables",
  },
};

/**
 * Parse environment variables and return stability configuration
 *
 * @returns Stability configuration object
 */
function parseEnvironmentConfig(): StabilityConfig {
  // Default to quick mode for local runs to keep iteration time manageable
  const defaultMode: StabilityMode = process.env.CI ? "standard" : "quick";
  const mode = (process.env.PW_STABILITY_MODE as StabilityMode) || defaultMode;

  if (!["quick", "standard", "extended", "custom"].includes(mode)) {
    throw new Error(
      `Invalid PW_STABILITY_MODE: ${mode}. Must be one of: quick, standard, extended, custom`
    );
  }

  // Get base configuration for mode
  const baseConfig = { ...MODE_DEFAULTS[mode] };

  // Override with environment variables if provided
  const envDuration = process.env.PW_STABILITY_DURATION;
  if (envDuration !== undefined) {
    const parsedDuration = Number.parseInt(envDuration, 10);
    if (Number.isNaN(parsedDuration) || parsedDuration <= 0) {
      throw new Error(`Invalid PW_STABILITY_DURATION: ${envDuration}. Must be a positive number.`);
    }
    baseConfig.duration = parsedDuration;
  }

  const envInterval = process.env.PW_STABILITY_INTERVAL;
  if (envInterval !== undefined) {
    const parsedInterval = Number.parseInt(envInterval, 10);
    if (Number.isNaN(parsedInterval) || parsedInterval <= 0) {
      throw new Error(`Invalid PW_STABILITY_INTERVAL: ${envInterval}. Must be a positive number.`);
    }
    baseConfig.interval = parsedInterval;
  }

  const envSwitchInterval = process.env.PW_STABILITY_SWITCH_INTERVAL;
  if (envSwitchInterval !== undefined) {
    const parsedSwitchInterval = Number.parseInt(envSwitchInterval, 10);
    if (Number.isNaN(parsedSwitchInterval) || parsedSwitchInterval <= 0) {
      throw new Error(
        `Invalid PW_STABILITY_SWITCH_INTERVAL: ${envSwitchInterval}. Must be a positive number.`
      );
    }
    baseConfig.switchInterval = parsedSwitchInterval;
  }

  const envCheckInterval = process.env.PW_STABILITY_CHECK_INTERVAL;
  if (envCheckInterval !== undefined) {
    const parsedCheckInterval = Number.parseInt(envCheckInterval, 10);
    if (Number.isNaN(parsedCheckInterval) || parsedCheckInterval <= 0) {
      throw new Error(
        `Invalid PW_STABILITY_CHECK_INTERVAL: ${envCheckInterval}. Must be a positive number.`
      );
    }
    baseConfig.checkInterval = parsedCheckInterval;
  }

  // Calculate iterations from duration and interval
  const iterations = Math.ceil((baseConfig.duration || 300000) / (baseConfig.interval || 30000));

  return {
    mode,
    duration: baseConfig.duration || 300000,
    iterations,
    interval: baseConfig.interval || 30000,
    switchInterval: baseConfig.switchInterval || 60000,
    checkInterval: baseConfig.checkInterval || 10000,
    enableMemoryProfiling: baseConfig.enableMemoryProfiling ?? true,
    verboseLogging: baseConfig.verboseLogging ?? true,
    description: baseConfig.description || "Custom configuration",
  };
}

/**
 * Create and return the active stability configuration
 * Lazily initializes and caches the configuration
 */
let cachedConfig: StabilityConfig | null = null;

export function getStabilityConfig(): StabilityConfig {
  if (!cachedConfig) {
    cachedConfig = parseEnvironmentConfig();
  }
  return cachedConfig;
}

/**
 * Reset cached configuration (mainly for testing)
 */
export function resetStabilityConfig(): void {
  cachedConfig = null;
}

/**
 * Log configuration details
 */
export function logStabilityConfig(): void {
  const config = getStabilityConfig();
  console.log("\n========================================");
  console.log("Stability Test Configuration");
  console.log("========================================");
  console.log(`Mode: ${config.mode}`);
  console.log(`Description: ${config.description}`);
  console.log(`Duration: ${config.duration / 1000}s (${(config.duration / 60000).toFixed(2)}m)`);
  console.log(`Iterations: ${config.iterations}`);
  console.log(`Check Interval: ${config.interval / 1000}s`);
  console.log(`Tenant Switch Interval: ${config.switchInterval / 1000}s`);
  console.log(`WebSocket Check Interval: ${config.checkInterval / 1000}s`);
  console.log(`Memory Profiling: ${config.enableMemoryProfiling ? "enabled" : "disabled"}`);
  console.log(`Verbose Logging: ${config.verboseLogging ? "enabled" : "disabled"}`);
  console.log("========================================\n");
}

/**
 * Format duration to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

// Export mode defaults for reference and testing
export const modeDefaults = MODE_DEFAULTS;
