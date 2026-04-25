import type { DuckFlowConfig } from "../schema";

export type EnvValueType = "string" | "number" | "boolean" | "enum";

type EnumDefinition = {
  type: "enum";
  values: readonly string[];
};

type PrimitiveDefinition = { type: "string" | "number" | "boolean" };

export interface EnvVarDefinition {
  name: string;
  description: string;
  targetPath: string;
  category: "environment" | "event" | "render" | "entity" | "performance" | "plugin";
  defaultValue: string | number | boolean;
  docsLink?: string;
  requirementRef?: string;
  value: PrimitiveDefinition | EnumDefinition;
}

export const ENV_VAR_DEFINITIONS: EnvVarDefinition[] = [
  {
    name: "DUCKFLOW_ENVIRONMENT",
    description: "Override deployment environment (development/staging/production)",
    targetPath: "environment",
    category: "environment",
    defaultValue: "development",
    requirementRef: "FR-1.3.1",
    value: {
      type: "enum",
      values: ["development", "staging", "production"],
    },
  },
  {
    name: "DUCKFLOW_EVENT_BATCH_SIZE",
    description: "Maximum number of events flushed per batch",
    targetPath: "event.batchSize",
    category: "event",
    defaultValue: 10,
    requirementRef: "FR-1.3.1",
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_EVENT_BATCH_INTERVAL",
    description: "Interval in milliseconds before forcing an event flush",
    targetPath: "event.batchInterval",
    category: "event",
    defaultValue: 100,
    requirementRef: "FR-1.3.1",
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_EVENT_MAX_QUEUE_SIZE",
    description: "Maximum buffered events before backpressure engages",
    targetPath: "event.maxQueueSize",
    category: "event",
    defaultValue: 1000,
    requirementRef: "FR-1.3.1",
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_EVENT_ENABLE_DEDUP",
    description: "Enable server-side event deduplication",
    targetPath: "event.enableDedup",
    category: "event",
    defaultValue: true,
    requirementRef: "FR-1.3.2",
    value: { type: "boolean" },
  },
  {
    name: "DUCKFLOW_EVENT_CONCURRENCY_LIMIT",
    description: "Maximum number of concurrent event processors",
    targetPath: "event.concurrencyLimit",
    category: "event",
    defaultValue: 4,
    requirementRef: "FR-1.3.2",
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_EVENT_MAX_LISTENERS",
    description: "Upper bound for registered event listeners per manager",
    targetPath: "event.maxListeners",
    category: "event",
    defaultValue: 1000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_RENDER_FRAME_RATE",
    description: "Target render frame rate",
    targetPath: "render.frameRate",
    category: "render",
    defaultValue: 60,
    requirementRef: "FR-1.3.2",
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_RENDER_CACHE_TTL",
    description: "Renderer cache time-to-live in milliseconds",
    targetPath: "render.cacheTTL",
    category: "render",
    defaultValue: 300000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_RENDER_MAX_CACHE_SIZE",
    description: "Maximum cache entries for renderer outputs",
    targetPath: "render.maxCacheSize",
    category: "render",
    defaultValue: 1000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_RENDER_DEFAULT_RENDERER",
    description: "Default renderer selection (react/canvas/webgpu)",
    targetPath: "render.defaultRenderer",
    category: "render",
    defaultValue: "react",
    value: {
      type: "enum",
      values: ["react", "canvas", "webgpu"],
    },
  },
  {
    name: "DUCKFLOW_RENDER_ENABLE_DIRTY_REGION",
    description: "Toggle dirty-region incremental rendering",
    targetPath: "render.enableDirtyRegion",
    category: "render",
    defaultValue: true,
    value: { type: "boolean" },
  },
  {
    name: "DUCKFLOW_RENDER_CONSTANTS_SMALL",
    description: "Threshold for SMALL render annotations",
    targetPath: "render.constants.SMALL",
    category: "render",
    defaultValue: 100,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_RENDER_CONSTANTS_MEDIUM",
    description: "Threshold for MEDIUM render annotations",
    targetPath: "render.constants.MEDIUM",
    category: "render",
    defaultValue: 1000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_RENDER_CONSTANTS_LARGE",
    description: "Threshold for LARGE render annotations",
    targetPath: "render.constants.LARGE",
    category: "render",
    defaultValue: 5000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_ENTITY_MAX_ENTITIES",
    description: "Maximum entities allowed in runtime",
    targetPath: "entity.maxEntities",
    category: "entity",
    defaultValue: 10000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_ENTITY_GC_INTERVAL",
    description: "Entity garbage collection interval in milliseconds",
    targetPath: "entity.gcInterval",
    category: "entity",
    defaultValue: 300000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_ENTITY_ENABLE_ENTITY_POOL",
    description: "Enable object pooling for entity lifecycle",
    targetPath: "entity.enableEntityPool",
    category: "entity",
    defaultValue: true,
    value: { type: "boolean" },
  },
  {
    name: "DUCKFLOW_PERFORMANCE_ENABLE_PROFILING",
    description: "Enable performance profiler instrumentation",
    targetPath: "performance.enableProfiling",
    category: "performance",
    defaultValue: false,
    value: { type: "boolean" },
  },
  {
    name: "DUCKFLOW_PERFORMANCE_METRICS_INTERVAL",
    description: "Interval in milliseconds between performance metric flushes",
    targetPath: "performance.metricsInterval",
    category: "performance",
    defaultValue: 5000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_PERFORMANCE_ENABLE_VERBOSE_LOGGING",
    description: "Enable verbose diagnostic logging for performance insights",
    targetPath: "performance.enableVerboseLogging",
    category: "performance",
    defaultValue: false,
    value: { type: "boolean" },
  },
  {
    name: "DUCKFLOW_PLUGIN_SANDBOX_TIMEOUT",
    description: "Sandbox execution timeout in milliseconds",
    targetPath: "plugin.sandboxTimeout",
    category: "plugin",
    defaultValue: 5000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_PLUGIN_CAPABILITY_CACHE_ENABLED",
    description: "Enable plugin capability cache",
    targetPath: "plugin.capabilityCache.enabled",
    category: "plugin",
    defaultValue: true,
    value: { type: "boolean" },
  },
  {
    name: "DUCKFLOW_PLUGIN_CAPABILITY_CACHE_DEFAULT_TTL_MS",
    description: "Default TTL for plugin capability cache entries in milliseconds",
    targetPath: "plugin.capabilityCache.defaultTtlMs",
    category: "plugin",
    defaultValue: 300000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_PLUGIN_CAPABILITY_CACHE_MAX_SIZE",
    description: "Maximum cache entries for plugin capabilities",
    targetPath: "plugin.capabilityCache.maxSize",
    category: "plugin",
    defaultValue: 1000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_PLUGIN_EXECUTION_DEFAULT_TIMEOUT_MS",
    description: "Default timeout in milliseconds for plugin executions",
    targetPath: "plugin.execution.defaultTimeoutMs",
    category: "plugin",
    defaultValue: 5000,
    value: { type: "number" },
  },
  {
    name: "DUCKFLOW_PLUGIN_EXECUTION_MAX_RETRIES",
    description: "Maximum retries for plugin execution failures",
    targetPath: "plugin.execution.maxRetries",
    category: "plugin",
    defaultValue: 3,
    value: { type: "number" },
  },
];

export function applyEnvVar(
  config: Partial<DuckFlowConfig>,
  definition: EnvVarDefinition,
  rawValue: string
): void {
  const value = parseValue(definition, rawValue);
  setDeepValue(config, definition.targetPath.split("."), value);
}

function parseValue(definition: EnvVarDefinition, rawValue: string): string | number | boolean {
  const spec = definition.value;
  if (spec.type === "number") {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) {
      throw new Error(`Environment variable ${definition.name} expects a numeric value`);
    }
    return parsed;
  }
  if (spec.type === "boolean") {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    throw new Error(`Environment variable ${definition.name} expects a boolean value`);
  }
  if (spec.type === "enum") {
    if (!spec.values.includes(rawValue)) {
      throw new Error(
        `Environment variable ${definition.name} expects one of ${spec.values.join(", ")}`
      );
    }
    return rawValue;
  }
  return rawValue;
}

function setDeepValue(target: Record<string, unknown>, path: string[], value: unknown): void {
  if (path.length === 0) {
    return;
  }

  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const existing = cursor[key];
    if (!existing || typeof existing !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[path[path.length - 1]] = value;
}

export function getEnvVarDefinition(name: string): EnvVarDefinition | undefined {
  return ENV_VAR_DEFINITIONS.find((definition) => definition.name === name);
}

export type EnvVarCategory = EnvVarDefinition["category"];
