/**
 * Runtime context orchestration for the public API layer.
 *
 * Manages the active `KoduckFlowRuntime` stack, missing-runtime diagnostics, and
 * the proxy (`runtime`) that exposes runtime methods to consumers. All high-level
 * API modules depend on these utilities to gain safe access to the runtime state.
 *
 * This module provides:
 * 1. Runtime stack management with scoped entry/exit
 * 2. Global configuration for missing-runtime error handling
 * 3. Event listeners for runtime lifecycle events
 * 4. A transparent proxy for automatic runtime resolution
 * 5. Development environment detection for debugging
 *
 * Usage example:
 * ```typescript
 * import { setApiRuntime, clearApiRuntime, runtime } from './runtime-context';
 * import { createEntity } from './entity';
 *
 * const token = setApiRuntime(koduckFlowRuntimeInstance, { tenantId: 'org-123' });
 * try {
 *   const entity = createEntity('MyEntity'); // Uses runtime from context
 * } finally {
 *   clearApiRuntime(token);
 * }
 *
 * // Or use the convenience wrapper
 * runWithApiRuntime(runtimeInstance, () => {
 *   createEntity('MyEntity');
 * });
 * ```
 *
 * @module runtime-context
 * @see {@link ./entity | Entity API}
 * @see {@link ./render | Render API}
 * @see {@link ./manager | Manager API}
 */
import {
  KoduckFlowRuntime,
  type ResolvedTenantContext,
  type RuntimeEnvironmentKey,
} from "../runtime";
import { logger } from "../logger";

/**
 * Metadata associated with an API runtime context.
 *
 * @typedef {Object} ApiRuntimeMetadata
 * @property {string} [source] - The source of the runtime (e.g., 'global-runtime', 'provider').
 * @property {RuntimeEnvironmentKey} [environment] - The runtime environment key.
 * @property {string} [tenantId] - Optional tenant identifier for multi-tenant systems.
 * @property {ResolvedTenantContext} [tenant] - Optional resolved tenant context information.
 */
export type ApiRuntimeMetadata = {
  source?: string | undefined;
  environment?: RuntimeEnvironmentKey | undefined;
  tenantId?: string | undefined;
  tenant?: ResolvedTenantContext | undefined;
};

type ApiRuntimeEntry = {
  token: symbol;
  runtime: KoduckFlowRuntime;
  metadata: ApiRuntimeMetadata;
};

/**
 * Unique token identifying an API runtime context entry.
 * Used to track and clear runtime contexts.
 */
export type ApiRuntimeToken = symbol;

const apiRuntimeStack: ApiRuntimeEntry[] = [];

/**
 * Information about missing runtime error events.
 *
 * @typedef {Object} ApiRuntimeMissingInfo
 * @property {ApiRuntimeMetadata} [metadata] - Metadata about the runtime context.
 * @property {string} [stack] - Stack trace information for debugging.
 * @property {Error} [error] - The error that was thrown.
 */
export type ApiRuntimeMissingInfo = {
  metadata?: ApiRuntimeMetadata;
  stack?: string;
  error?: Error;
};

/**
 * Configuration for API runtime behavior.
 *
 * @typedef {Object} ApiRuntimeConfig
 * @property {Function} [onMissingRuntime] - Callback invoked when no active runtime is found.
 */
export type ApiRuntimeConfig = {
  onMissingRuntime?: ((info: ApiRuntimeMissingInfo) => void) | undefined;
};

const DEFAULT_API_RUNTIME_CONFIG: Readonly<ApiRuntimeConfig> = Object.freeze({});

let apiRuntimeConfig: ApiRuntimeConfig = { ...DEFAULT_API_RUNTIME_CONFIG };

type ApiRuntimeMissingListener = (info: ApiRuntimeMissingInfo) => void;

const apiRuntimeMissingListeners = new Set<ApiRuntimeMissingListener>();

function safeInvokeMissingListener(
  listener: ApiRuntimeMissingListener,
  info: ApiRuntimeMissingInfo
): void {
  try {
    listener(info);
  } catch (error) {
    logger.error("Unexpected error while handling missing API runtime", {
      error,
    });
  }
}

function notifyRuntimeMissing(info: ApiRuntimeMissingInfo): void {
  for (const listener of apiRuntimeMissingListeners) {
    safeInvokeMissingListener(listener, info);
  }
}

/**
 * Registers a listener for missing runtime events.
 *
 * Adds a listener that will be invoked whenever an operation attempts to access
 * the runtime but no active runtime is available. Useful for logging, error tracking,
 * or fallback behavior in development environments.
 *
 * @param {ApiRuntimeMissingListener} listener - Function to invoke on missing runtime.
 * @returns {Function} Cleanup function that removes the listener when called.
 *
 * Usage example:
 * ```typescript
 * const unsubscribe = addApiRuntimeMissingListener((info) => {
 * console.warn('Runtime missing!', info.stack);
 * });
 *
 * unsubscribe();
 * ```
 *
 * @see {@link removeApiRuntimeMissingListener | removeApiRuntimeMissingListener}
 */
export function addApiRuntimeMissingListener(listener: ApiRuntimeMissingListener): () => void {
  apiRuntimeMissingListeners.add(listener);
  return () => {
    apiRuntimeMissingListeners.delete(listener);
  };
}

/**
 * Removes a previously registered missing runtime listener.
 *
 * Unregisters a listener from the missing runtime event system.
 *
 * @param {ApiRuntimeMissingListener} listener - The listener function to remove.
 * @returns {void}
 *
 * @see {@link addApiRuntimeMissingListener | addApiRuntimeMissingListener}
 */
export function removeApiRuntimeMissingListener(listener: ApiRuntimeMissingListener): void {
  apiRuntimeMissingListeners.delete(listener);
}

/**
 * Legacy alias for addApiRuntimeMissingListener.
 *
 * @deprecated Use addApiRuntimeMissingListener instead.
 * @param {ApiRuntimeMissingListener} listener - Function to invoke on missing runtime.
 * @returns {Function} Cleanup function that removes the listener.
 *
 * @see {@link addApiRuntimeMissingListener | addApiRuntimeMissingListener}
 */
export function addApiRuntimeFallbackListener(listener: ApiRuntimeMissingListener): () => void {
  return addApiRuntimeMissingListener(listener);
}

/**
 * Legacy alias for removeApiRuntimeMissingListener.
 *
 * @deprecated Use removeApiRuntimeMissingListener instead.
 * @param {ApiRuntimeMissingListener} listener - The listener function to remove.
 * @returns {void}
 *
 * @see {@link removeApiRuntimeMissingListener | removeApiRuntimeMissingListener}
 */
export function removeApiRuntimeFallbackListener(listener: ApiRuntimeMissingListener): void {
  removeApiRuntimeMissingListener(listener);
}

type GlobalWithProcess = typeof globalThis & {
  process?: {
    env?: {
      NODE_ENV?: string;
    };
  };
};

function getNodeEnv(): string | undefined {
  const { process } = globalThis as GlobalWithProcess;
  return process?.env?.NODE_ENV;
}

function detectDevEnvironment(): boolean {
  const nodeEnv = getNodeEnv();
  if (nodeEnv) {
    return nodeEnv !== "production";
  }

  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } })?.env?.DEV);
  } catch {
    return false;
  }
}

const shouldTraceMissingRuntime = detectDevEnvironment();

if (shouldTraceMissingRuntime) {
  addApiRuntimeMissingListener((info) => {
    if (info.stack) {
      logger.debug("[koduck-flow] Captured missing runtime stack", {
        stack: info.stack,
      });
    }
  });
}

/**
 *
 */
export class KoduckFlowRuntimeMissingError extends Error {
  readonly metadata?: ApiRuntimeMetadata;

  /**
   *
   * @param message
   * @param metadata
   */
  constructor(message: string, metadata?: ApiRuntimeMetadata) {
    super(message);
    this.name = "KoduckFlowRuntimeMissingError";
    if (metadata !== undefined) {
      this.metadata = metadata;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 *
 * @param config
 */
export function setApiRuntimeConfig(config: Partial<ApiRuntimeConfig>): ApiRuntimeConfig {
  apiRuntimeConfig = {
    ...apiRuntimeConfig,
    ...config,
  };
  return { ...apiRuntimeConfig };
}

/**
 *
 */
export function getApiRuntimeConfig(): ApiRuntimeConfig {
  return { ...apiRuntimeConfig };
}

/**
 *
 */
export function resetApiRuntimeConfig(): void {
  apiRuntimeConfig = { ...DEFAULT_API_RUNTIME_CONFIG };
}

/**
 *
 * @param runtime
 * @param metadata
 */
export function setApiRuntime(
  runtime: KoduckFlowRuntime | null | undefined,
  metadata: ApiRuntimeMetadata = {}
): ApiRuntimeToken | null {
  if (!runtime) {
    return null;
  }

  const token: ApiRuntimeToken = Symbol("koduck-flow-api-runtime");
  apiRuntimeStack.push({ token, runtime, metadata });
  return token;
}

/**
 *
 * @param token
 */
export function clearApiRuntime(token: ApiRuntimeToken | null | undefined): void {
  if (!token) {
    return;
  }

  const index = apiRuntimeStack.findIndex((entry) => entry.token === token);
  if (index !== -1) {
    apiRuntimeStack.splice(index, 1);
  }
}

function getActiveApiRuntimeEntry(): ApiRuntimeEntry | undefined {
  return apiRuntimeStack[apiRuntimeStack.length - 1];
}

/**
 *
 */
export function getApiRuntime(): KoduckFlowRuntime {
  const active = getActiveApiRuntimeEntry();
  if (active) {
    return active.runtime;
  }

  const config = apiRuntimeConfig;
  const stack = new Error().stack;
  const metadata: ApiRuntimeMetadata = {
    source: "global-runtime",
  };
  const info: ApiRuntimeMissingInfo = {
    metadata,
  };

  if (stack) {
    info.stack = stack;
  }

  const error = new KoduckFlowRuntimeMissingError(
    "No active KoduckFlow runtime found. Call setApiRuntime() (for scoped usage) or wrap your app with KoduckFlowProvider to provide the runtime context.",
    metadata
  );
  info.error = error;

  if (config.onMissingRuntime) {
    try {
      config.onMissingRuntime(info);
    } catch (handlerError) {
      logger.error("Unexpected error in API runtime missing handler", {
        error: handlerError,
      });
    }
  }

  notifyRuntimeMissing(info);

  throw error;
}

/**
 *
 */
export function getApiRuntimeInfo(): ApiRuntimeMetadata & {
  isLegacyFallback: boolean;
} {
  const active = getActiveApiRuntimeEntry();
  if (active) {
    return {
      ...active.metadata,
      isLegacyFallback: false,
    };
  }

  return {
    source: "global-runtime",
    isLegacyFallback: true,
  };
}

/**
 *
 * @param runtime
 * @param fn
 * @param metadata
 */
export function runWithApiRuntime<T>(
  runtime: KoduckFlowRuntime,
  fn: () => T,
  metadata: ApiRuntimeMetadata = {}
): T {
  const token = setApiRuntime(runtime, metadata);
  try {
    return fn();
  } finally {
    clearApiRuntime(token);
  }
}

function bindRuntimeValue(value: unknown, runtime: KoduckFlowRuntime) {
  if (typeof value === "function") {
    return (value as (...args: unknown[]) => unknown).bind(runtime);
  }
  return value;
}

const runtimeProxyTarget = Object.create(KoduckFlowRuntime.prototype) as KoduckFlowRuntime;

/**
 * Runtime proxy that automatically resolves to the current active runtime.
 *
 * This proxy is used by the API layer to access the runtime without
 * explicitly passing it around. It will throw if no runtime is active.
 *
 * @internal
 */
export const runtime = new Proxy(runtimeProxyTarget, {
  get(_target, prop, receiver) {
    const rt = getApiRuntime();
    const value = Reflect.get(rt as unknown as object, prop, receiver);
    return bindRuntimeValue(value, rt);
  },
  set(_target, prop, value) {
    const rt = getApiRuntime();
    Reflect.set(rt as unknown as object, prop, value);
    return true;
  },
  has(_target, prop) {
    const rt = getApiRuntime();
    return prop in (rt as unknown as object);
  },
  ownKeys() {
    const rt = getApiRuntime();
    return Reflect.ownKeys(rt as unknown as object);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const rt = getApiRuntime();
    return Object.getOwnPropertyDescriptor(rt as unknown as object, prop);
  },
}) as KoduckFlowRuntime;

/**
 * Get the runtime proxy.
 *
 * @returns The runtime proxy instance
 */
export function getRuntimeProxy(): KoduckFlowRuntime {
  return runtime;
}
