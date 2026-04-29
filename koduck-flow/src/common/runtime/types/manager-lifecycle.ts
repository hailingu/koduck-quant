/**
 * Manager lifecycle state-related type definitions
 * @module runtime/types/manager-lifecycle
 */

/**
 * Manager lifecycle status enum
 */
export const MANAGER_LIFECYCLE_STATUS = {
  /** Registered but not initialized */
  Registered: "registered",
  /** Initializing */
  Initializing: "initializing",
  /** Ready (initialization succeeded) */
  Ready: "ready",
  /** Initialization failed */
  Failed: "failed",
} as const;

/**
 * Manager lifecycle status type
 */
export type ManagerLifecycleStatus =
  (typeof MANAGER_LIFECYCLE_STATUS)[keyof typeof MANAGER_LIFECYCLE_STATUS];

/**
 * Manager lifecycle state object
 */
export type ManagerLifecycleState = {
  /** Current status */
  status: ManagerLifecycleStatus;
  /** Initialization Promise (if currently initializing) */
  promise?: Promise<void>;
  /** Error info (if initialization failed) */
  error?: unknown;
  /** Dependency path (used for circular dependency detection) */
  path?: string[];
};

/**
 * Manager initialization error class
 */
export class ManagerInitializationError extends Error {
  /** Dependency path */
  readonly path: string[];

  constructor(name: string, message: string, options?: { cause?: unknown; path?: string[] }) {
    const errorOptions = options?.cause === undefined ? undefined : { cause: options.cause };
    super(`Manager '${name}': ${message}`, errorOptions);
    this.name = "ManagerInitializationError";
    this.path = options?.path ?? [];
  }
}

/**
 * Core Manager key constants
 */
export const CORE_MANAGER_KEYS = ["entity", "render", "registry"] as const;

/**
 * Core Manager key type
 */
export type CoreManagerKey = (typeof CORE_MANAGER_KEYS)[number];

/**
 * Manager initialization timeout flag (internal use)
 */
export const INITIALIZATION_TIMEOUT_FLAG = Symbol("koduck-flow-manager-init-timeout");
