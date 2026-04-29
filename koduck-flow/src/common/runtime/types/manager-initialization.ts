/**
 * Manager initialization-related type definitions
 * @module runtime/types/manager-initialization
 */

/**
 * Manager initialization retry configuration
 */
export interface ManagerInitializationRetryConfig {
  /**
   * Retry attempts (default 1, meaning no retry)
   */
  attempts?: number;

  /**
   * Retry delay (milliseconds)
   */
  delayMs?: number;
}

/**
 * Manager initialization options
 */
export interface ManagerInitializationOptions {
  /**
   * Retry configuration
   */
  retries?: ManagerInitializationRetryConfig;

  /**
   * Initialization timeout (milliseconds)
   */
  timeoutMs?: number;

  /**
   * Whether to warn on retry (default true)
   */
  warnOnRetry?: boolean;
}

/**
 * Manager registration options
 */
export interface ManagerRegistrationOptions {
  /**
   * Whether to lazy-load (initialize only on first access)
   */
  lazy?: boolean;

  /**
   * Whether this is a required Manager (blocks runtime startup if initialization fails)
   */
  required?: boolean;

  /**
   * List of other Manager names this depends on
   */
  dependencies?: string[];

  /**
   * Custom initialization options (override runtime-level config)
   */
  initialization?: ManagerInitializationOptions;
}

/**
 * Normalized Manager initialization config (internal use)
 */
export type NormalizedManagerInitializationConfig = {
  retries: {
    attempts: number;
    delayMs: number;
  };
  timeoutMs?: number;
  warnOnRetry: boolean;
};

/**
 * Default Manager initialization config
 */
export const DEFAULT_MANAGER_INITIALIZATION_CONFIG: NormalizedManagerInitializationConfig = {
  retries: {
    attempts: 1,
    delayMs: 0,
  },
  warnOnRetry: true,
};
