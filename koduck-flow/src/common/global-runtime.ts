import { logger } from "./logger";
import {
  DuckFlowRuntime,
  DuckFlowRuntimeFactory,
  normalizeRuntimeKey,
  type RuntimeCreationOptions,
  type RuntimeEnvironmentKey,
} from "./runtime";

type EnvRecord = Record<string, unknown> | undefined;

function getProcessEnv(): EnvRecord {
  if (typeof globalThis === "undefined") {
    return undefined;
  }

  const proc = (globalThis as unknown as { process?: { env?: EnvRecord } }).process;
  return proc?.env ?? undefined;
}

function getImportMetaEnv(): EnvRecord {
  try {
    return (import.meta as unknown as { env?: EnvRecord })?.env ?? undefined;
  } catch (error) {
    logger.debug("无法访问 import.meta.env，已忽略", { error });
    return undefined;
  }
}

function firstString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

const processEnv = getProcessEnv();
const importMetaEnv = getImportMetaEnv();

const DEFAULT_ENVIRONMENT =
  firstString(
    processEnv?.DUCKFLOW_ENV,
    importMetaEnv?.DUCKFLOW_ENV,
    processEnv?.NODE_ENV,
    importMetaEnv?.NODE_ENV,
    importMetaEnv?.MODE
  ) ?? "default";

export const DEFAULT_DUCKFLOW_ENVIRONMENT = DEFAULT_ENVIRONMENT;

const runtimeFactory = new DuckFlowRuntimeFactory();

function mergeMetadata(
  key: RuntimeEnvironmentKey,
  options?: RuntimeCreationOptions
): RuntimeCreationOptions {
  const normalizedKey = normalizeRuntimeKey(key);
  const extraMetadata = {
    environment: key.environment,
    tenantId: key.tenantId,
    normalizedKey,
  };

  return {
    ...options,
    metadata: {
      ...extraMetadata,
      ...options?.metadata,
    },
  };
}

export function getRuntimeForKey(
  key: RuntimeEnvironmentKey,
  options?: RuntimeCreationOptions
): DuckFlowRuntime {
  logger.debug("🔍 获取 DuckFlowRuntime", {
    key,
  });
  return runtimeFactory.getOrCreateRuntime(key, mergeMetadata(key, options));
}

export function getRuntimeForEnvironment(
  environment: string,
  options?: RuntimeCreationOptions
): DuckFlowRuntime {
  return getRuntimeForKey({ environment }, options);
}

export function disposeRuntimeForEnvironment(environment: string): void {
  runtimeFactory.disposeRuntime({ environment });
}

export function disposeRuntimeForKey(key: RuntimeEnvironmentKey): void {
  runtimeFactory.disposeRuntime(key);
}

logger.info("🏛️ 创建默认环境的 DuckFlowRuntime 实例", {
  environment: DEFAULT_ENVIRONMENT,
});

/**
 * 全局默认环境 runtime（兼容旧逻辑）
 */
export const globalDuckFlowRuntime: DuckFlowRuntime = getRuntimeForEnvironment(
  DEFAULT_ENVIRONMENT,
  {
    metadata: {
      source: "global-runtime",
    },
  }
);

logger.info("🏛️ 默认环境 DuckFlowRuntime 实例创建完成", {
  environment: DEFAULT_ENVIRONMENT,
  normalizedKey: normalizeRuntimeKey({ environment: DEFAULT_ENVIRONMENT }),
  registryManager: globalDuckFlowRuntime.RegistryManager?.constructor?.name,
});

/**
 * 全局运行时管理 - 替代原 deity 全局单例
 */
let currentGlobalRuntime: DuckFlowRuntime | null = globalDuckFlowRuntime;

export type SetGlobalRuntimeOptions = {
  disposePrevious?: boolean;
};

export type ResetGlobalRuntimeOptions = RuntimeCreationOptions & {
  environment?: string;
  disposePrevious?: boolean;
};

export type DisposeGlobalRuntimeOptions = {
  environment?: string;
  releaseFromFactory?: boolean;
};

/**
 * Get the current global runtime instance.
 *
 * This is the recommended way to access a global runtime instance
 * when not using DuckFlowProvider (e.g., in scripts, CLI tools).
 *
 * @returns The current global runtime instance
 *
 * @example
 * ```typescript
 * import { getGlobalRuntime } from 'duck-flow';
 *
 * const runtime = getGlobalRuntime();
 * const entity = runtime.createEntity('MyEntity');
 * ```
 */
export function getGlobalRuntime(): DuckFlowRuntime {
  if (!currentGlobalRuntime) {
    currentGlobalRuntime = getRuntimeForEnvironment(DEFAULT_ENVIRONMENT, {
      metadata: {
        source: "global-runtime",
      },
    });
    logger.info("🏛️ 全局运行时已初始化", {
      environment: DEFAULT_ENVIRONMENT,
      registryManager: currentGlobalRuntime.RegistryManager?.constructor?.name,
    });
  }
  return currentGlobalRuntime;
}

/**
 * Set the global runtime instance.
 *
 * @param runtime - The runtime instance to set as global
 * @param options - Configuration options
 * @returns The set runtime instance
 *
 * @example
 * ```typescript
 * import { createDuckFlowRuntime, setGlobalRuntime } from 'duck-flow';
 *
 * const runtime = createDuckFlowRuntime();
 * setGlobalRuntime(runtime, { disposePrevious: true });
 * ```
 */
export function setGlobalRuntime(
  runtime: DuckFlowRuntime,
  options?: SetGlobalRuntimeOptions
): DuckFlowRuntime {
  if (!runtime) {
    throw new Error("Cannot set global runtime: runtime is undefined");
  }

  const previous = currentGlobalRuntime;
  currentGlobalRuntime = runtime;

  if (options?.disposePrevious && previous && previous !== runtime) {
    try {
      previous.dispose();
    } catch (error) {
      logger.warn("释放旧的全局运行时失败", { error });
    }
  }

  return currentGlobalRuntime;
}

/**
 * Reset the global runtime instance.
 *
 * Creates a new runtime and sets it as the global instance,
 * optionally disposing the previous one.
 *
 * @param options - Configuration options
 * @returns The new global runtime instance
 *
 * @example
 * ```typescript
 * import { resetGlobalRuntime } from 'duck-flow';
 *
 * const runtime = resetGlobalRuntime({ disposePrevious: true });
 * ```
 */
export function resetGlobalRuntime(options?: ResetGlobalRuntimeOptions): DuckFlowRuntime {
  const { environment = DEFAULT_ENVIRONMENT, disposePrevious, ...runtimeOptions } = options ?? {};

  const runtimeCreationOptions = runtimeOptions as RuntimeCreationOptions;
  const nextRuntime = getRuntimeForEnvironment(environment, runtimeCreationOptions);
  const setOptions =
    disposePrevious === undefined
      ? undefined
      : ({ disposePrevious } satisfies SetGlobalRuntimeOptions);

  return setGlobalRuntime(nextRuntime, setOptions);
}

/**
 * Dispose the global runtime instance.
 *
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * import { disposeGlobalRuntime } from 'duck-flow';
 *
 * disposeGlobalRuntime({ releaseFromFactory: true });
 * ```
 */
export function disposeGlobalRuntime(options?: DisposeGlobalRuntimeOptions): void {
  const runtime = currentGlobalRuntime;
  if (!runtime) {
    return;
  }

  currentGlobalRuntime = null;

  try {
    runtime.dispose();
  } catch (error) {
    logger.warn("释放全局运行时失败", { error });
  }

  if (options?.releaseFromFactory) {
    const environment = options.environment ?? DEFAULT_ENVIRONMENT;
    disposeRuntimeForEnvironment(environment);
  }
}
