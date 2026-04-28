/**
 * @module src/common/config/schema
 * @description Configuration schema definitions and validation for Duck Flow.
 * Provides strongly-typed configuration interfaces using Zod for runtime validation.
 * Covers all subsystems: events, rendering, entities, performance, multi-tenancy, and plugins.
 *
 * Architecture:
 * - **Interface-based**: TypeScript interfaces define configuration structure
 * - **Zod validation**: Zod schemas enforce runtime validation
 * - **Environment-aware**: Separate configs for development/staging/production
 * - **Subsystem isolation**: Each subsystem has dedicated config interface
 * - **Extensibility**: Easy to add new config sections
 *
 * Configuration Sections:
 * 1. **EventConfig** - Event system batching, deduplication, concurrency
 * 2. **RenderConfig** - Rendering frame rate, cache, dirty region optimization
 * 3. **EntityConfig** - Entity pool, garbage collection
 * 4. **PerformanceConfig** - Profiling, metrics, logging
 * 5. **TenantConfig** - Multi-tenancy quotas and limits
 * 6. **PluginConfig** - Sandbox timeout, capability cache, execution settings
 *
 * Usage Pattern:
 * 1. Extend interfaces if needed
 * 2. Update Zod schemas to match
 * 3. Call validateConfig() for runtime validation
 * 4. Handle validation errors with suggested fixes
 *
 * @example
 * ```typescript
 * import { DuckFlowConfig, validateConfig } from '@/config/schema';
 *
 * // Create configuration object
 * const config: DuckFlowConfig = {
 *   environment: 'production',
 *   event: {
 *     batchSize: 32,
 *     batchInterval: 16,
 *     maxQueueSize: 10000,
 *     enableDedup: true,
 *     concurrencyLimit: 100,
 *     maxListeners: 50
 *   },
 *   render: {
 *     frameRate: 60,
 *     cacheTTL: 300000,
 *     maxCacheSize: 1000,
 *     defaultRenderer: 'webgpu',
 *     enableDirtyRegion: true,
 *     constants: { SMALL: 10, MEDIUM: 100, LARGE: 1000 }
 *   },
 *   entity: {
 *     maxEntities: 100000,
 *     gcInterval: 60000,
 *     enableEntityPool: true
 *   },
 *   performance: {
 *     enableProfiling: false,
 *     metricsInterval: 5000,
 *     enableVerboseLogging: false
 *   },
 *   plugin: {
 *     sandboxTimeout: 5000,
 *     capabilityCache: { enabled: true, defaultTtlMs: 3600000, maxSize: 1000 },
 *     execution: { defaultTimeoutMs: 30000, maxRetries: 3 }
 *   }
 * };
 *
 * // Validate configuration
 * const result = validateConfig(config);
 * if (result.valid) {
 *   console.log('Configuration is valid');
 * } else {
 *   console.error('Validation errors:', result.errors);
 *   console.log('Suggested fixes:', result.errors[0].suggestion);
 * }
 *
 * // Development configuration with profiling
 * const devConfig: Partial<DuckFlowConfig> = {
 *   environment: 'development',
 *   performance: {
 *     enableProfiling: true,
 *     metricsInterval: 1000,
 *     enableVerboseLogging: true
 *   }
 * };
 * ```
 */

import { z } from "zod";

/**
 * Event System Configuration
 * @typedef {Object} EventConfig
 * @property {number} batchSize - Number of events to batch before processing (default: 32)
 * @property {number} batchInterval - Time window for batching in milliseconds (default: 16ms)
 * @property {number} maxQueueSize - Maximum pending events before blocking (default: 10000)
 * @property {boolean} enableDedup - Whether to deduplicate identical consecutive events
 * @property {number} concurrencyLimit - Maximum concurrent event handlers (default: 100)
 * @property {number} maxListeners - Maximum listeners per event type (default: 50)
 */
export interface EventConfig {
  batchSize: number;
  batchInterval: number;
  maxQueueSize: number;
  enableDedup: boolean;
  concurrencyLimit: number;
  maxListeners: number;
}

/**
 * Rendering System Configuration
 * @typedef {Object} RenderConfig
 * @property {number} frameRate - Target frames per second (default: 60)
 * @property {number} cacheTTL - Render cache time-to-live in milliseconds (default: 5 minutes)
 * @property {number} maxCacheSize - Maximum cached render operations (default: 1000)
 * @property {string} defaultRenderer - Preferred renderer: 'react' | 'canvas' | 'webgpu'
 * @property {boolean} enableDirtyRegion - Whether to optimize via dirty region tracking
 * @property {Object} constants - Size classification constants for rendering
 */
export interface RenderConfig {
  frameRate: number;
  cacheTTL: number;
  maxCacheSize: number;
  defaultRenderer: "react" | "canvas" | "webgpu";
  enableDirtyRegion: boolean;
  constants: {
    SMALL: number;
    MEDIUM: number;
    LARGE: number;
  };
}

/**
 * Entity System Configuration
 * @typedef {Object} EntityConfig
 * @property {number} maxEntities - Maximum entities before garbage collection (default: 100000)
 * @property {number} gcInterval - Garbage collection interval in milliseconds (default: 60000)
 * @property {boolean} enableEntityPool - Whether to use object pooling for entities
 */
export interface EntityConfig {
  maxEntities: number;
  gcInterval: number;
  enableEntityPool: boolean;
}

/**
 * Performance Monitoring Configuration
 * @typedef {Object} PerformanceConfig
 * @property {boolean} enableProfiling - Enable CPU/memory profiling (default: false for production)
 * @property {number} metricsInterval - Metrics collection interval in milliseconds (default: 5000)
 * @property {boolean} enableVerboseLogging - Enable detailed logging output (default: false)
 */
export interface PerformanceConfig {
  enableProfiling: boolean;
  metricsInterval: number;
  enableVerboseLogging: boolean;
}

/**
 * Multi-Tenancy Configuration
 * @typedef {Object} TenantConfig
 * @property {boolean} enabled - Whether to enable multi-tenancy support
 * @property {Object} defaultQuota - Resource quotas per tenant
 * @property {number} defaultQuota.maxEntities - Maximum entities per tenant
 * @property {number} defaultQuota.maxFlows - Maximum flows per tenant
 * @property {number} defaultQuota.storageLimit - Storage limit in bytes per tenant
 */
export interface TenantConfig {
  enabled: boolean;
  defaultQuota: {
    maxEntities: number;
    maxFlows: number;
    storageLimit: number;
  };
}

/**
 * Plugin System Configuration
 * @typedef {Object} PluginConfig
 * @property {number} sandboxTimeout - Sandbox execution timeout in milliseconds (default: 5000)
 * @property {Object} capabilityCache - Capability detection cache settings
 * @property {boolean} capabilityCache.enabled - Enable capability caching
 * @property {number} capabilityCache.defaultTtlMs - Cache entry TTL in milliseconds
 * @property {number} capabilityCache.maxSize - Maximum cached capabilities
 * @property {Object} execution - Plugin execution settings
 * @property {number} execution.defaultTimeoutMs - Plugin execution timeout (default: 30000)
 * @property {number} execution.maxRetries - Maximum retry attempts (default: 3)
 */
export interface PluginConfig {
  sandboxTimeout: number;
  capabilityCache: {
    enabled: boolean;
    defaultTtlMs: number;
    maxSize: number;
  };
  execution: {
    defaultTimeoutMs: number;
    maxRetries: number;
  };
}

/**
 * Complete Duck Flow Configuration Interface
 * @typedef {Object} DuckFlowConfig
 * @property {string} environment - Runtime environment: 'development' | 'staging' | 'production'
 * @property {EventConfig} event - Event system configuration
 * @property {RenderConfig} render - Rendering system configuration
 * @property {EntityConfig} entity - Entity system configuration
 * @property {PerformanceConfig} performance - Performance monitoring configuration
 * @property {TenantConfig} [tenant] - Multi-tenancy configuration (optional)
 * @property {PluginConfig} plugin - Plugin system configuration
 */
export interface DuckFlowConfig {
  environment: "development" | "staging" | "production";
  event: EventConfig;
  render: RenderConfig;
  entity: EntityConfig;
  performance: PerformanceConfig;
  tenant?: TenantConfig;
  plugin: PluginConfig;
}

/**
 * Configuration Validation Issue
 * @typedef {Object} ValidationIssue
 * @property {string} path - Configuration path using dot notation (e.g., 'render.frameRate')
 * @property {string} message - Specific error message explaining the validation failure
 */
export interface ValidationIssue {
  path: string;
  message: string;
  hint: string;
  /** Zod issue code */
  code: string;
  /** 严重级别 */
  severity: "error" | "warning";
  /** 期望值或范围描述 */
  expected?: string;
  /** 实际收到的值 */
  received?: unknown;
}

/**
 *
 */
export interface ValidationResult {
  /** 是否通过验证 */
  isValid: boolean;
  /** 致命错误集合 */
  errors: ValidationIssue[];
  /** 可恢复或范围警告 */
  warnings: ValidationIssue[];
  /** 验证耗时（毫秒） */
  durationMs: number;
}

/**
 * 配置源类型
 */
export type ConfigSource = "defaults" | "file" | "env" | "runtime";

/**
 * Zod Schema Definitions
 */

// 环境枚举
export const EnvironmentSchema = z.enum(["development", "staging", "production"]);

// 渲染器类型枚举
export const RendererTypeSchema = z.enum(["react", "canvas", "webgpu"]);

// 事件配置 Schema
export const EventConfigSchema = z
  .object({
    batchSize: z.number().int().min(1, "batchSize must be >= 1"),
    batchInterval: z.number().int().min(0, "batchInterval must be >= 0"),
    maxQueueSize: z.number().int().min(1, "maxQueueSize must be >= 1"),
    enableDedup: z.boolean(),
    concurrencyLimit: z.number().int().min(1, "concurrencyLimit must be >= 1"),
    maxListeners: z.number().int().min(1, "maxListeners must be >= 1"),
  })
  .strict();

// 渲染配置 Schema
export const RenderConfigSchema = z
  .object({
    frameRate: z.number().int().min(1).max(240, "frameRate should be between 1 and 240"),
    cacheTTL: z.number().int().min(0, "cacheTTL must be >= 0"),
    maxCacheSize: z.number().int().min(1, "maxCacheSize must be >= 1"),
    defaultRenderer: RendererTypeSchema,
    enableDirtyRegion: z.boolean(),
    constants: z
      .object({
        SMALL: z.number().int().min(0),
        MEDIUM: z.number().int().min(0),
        LARGE: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

// 实体配置 Schema
export const EntityConfigSchema = z
  .object({
    maxEntities: z.number().int().min(1, "maxEntities must be >= 1"),
    gcInterval: z.number().int().min(1000, "gcInterval must be >= 1000ms"),
    enableEntityPool: z.boolean(),
  })
  .strict();

// 性能配置 Schema
export const PerformanceConfigSchema = z
  .object({
    enableProfiling: z.boolean(),
    metricsInterval: z.number().int().min(100, "metricsInterval must be >= 100ms"),
    enableVerboseLogging: z.boolean(),
  })
  .strict();

// 租户配置 Schema
export const TenantConfigSchema = z
  .object({
    enabled: z.boolean(),
    defaultQuota: z
      .object({
        maxEntities: z.number().int().min(1),
        maxFlows: z.number().int().min(1),
        storageLimit: z.number().int().min(1),
      })
      .strict(),
  })
  .strict();

// 插件配置 Schema
export const PluginConfigSchema = z
  .object({
    sandboxTimeout: z.number().int().min(100, "sandboxTimeout must be >= 100ms"),
    capabilityCache: z
      .object({
        enabled: z.boolean(),
        defaultTtlMs: z.number().int().min(1000, "defaultTtlMs must be >= 1000ms"),
        maxSize: z.number().int().min(1, "maxSize must be >= 1"),
      })
      .strict(),
    execution: z
      .object({
        defaultTimeoutMs: z.number().int().min(100, "defaultTimeoutMs must be >= 100ms"),
        maxRetries: z.number().int().min(0, "maxRetries must be >= 0"),
      })
      .strict(),
  })
  .strict();

// DuckFlow 配置 Schema
export const DuckFlowConfigSchema = z
  .object({
    environment: EnvironmentSchema,
    event: EventConfigSchema,
    render: RenderConfigSchema,
    entity: EntityConfigSchema,
    performance: PerformanceConfigSchema,
    tenant: TenantConfigSchema.optional(),
    plugin: PluginConfigSchema,
  })
  .strict();

/**
 * 验证配置
 * @param config
 */
export function validateConfig(config: unknown): ValidationResult {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const result = DuckFlowConfigSchema.safeParse(config);
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  const durationMs = Number(end - start);

  if (result.success) {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      durationMs,
    };
  }

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const issue of result.error.issues) {
    const issueDetail = transformIssue(issue);

    if (issueDetail.severity === "warning") {
      warnings.push(issueDetail);
    } else {
      errors.push(issueDetail);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    durationMs,
  };
}

type SchemaIssue = z.ZodError<DuckFlowConfig>["issues"][number];

function transformIssue(issue: SchemaIssue): ValidationIssue {
  const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
  const detail: ValidationIssue = {
    path,
    message: issue.message,
    hint: "",
    code: issue.code,
    severity: "error",
  };

  switch (issue.code) {
    case "invalid_type": {
      const data = issue as unknown as { expected: unknown; received: unknown };
      detail.expected = Array.isArray(data.expected)
        ? data.expected.map(String).join(" | ")
        : String(data.expected);
      detail.received = data.received;
      detail.hint = `请将 ${path} 的类型调整为 ${detail.expected}。`;
      break;
    }
    case "invalid_value": {
      const data = issue as unknown as {
        received?: unknown;
        expected?: unknown;
        options?: unknown[];
        expectedValues?: unknown[];
      };
      const options = data.options ?? data.expectedValues;
      if (Array.isArray(options)) {
        detail.expected = options.map((opt) => JSON.stringify(opt)).join(" | ");
        detail.received = data.received;
        detail.hint = `请在 ${path} 中选择 ${detail.expected} 之一。`;
      } else if (data.expected !== undefined) {
        detail.expected = JSON.stringify(data.expected);
        detail.received = data.received;
        detail.hint = `请将 ${path} 的值设置为 ${detail.expected}。`;
      } else {
        detail.hint = "请根据错误信息检查配置值是否在允许范围内。";
      }
      break;
    }
    case "too_small": {
      const data = issue as unknown as {
        minimum?: number | bigint;
        type: string;
        inclusive?: boolean;
      };
      detail.expected = buildRangeExpectation(
        "最低",
        data.minimum,
        data.type,
        data.inclusive !== false
      );
      detail.hint = `请确保 ${path} ${detail.expected}。`;
      break;
    }
    case "too_big": {
      const data = issue as unknown as {
        maximum?: number | bigint;
        type: string;
        inclusive?: boolean;
      };
      detail.expected = buildRangeExpectation(
        "最高",
        data.maximum,
        data.type,
        data.inclusive !== false
      );
      detail.hint = `请确保 ${path} ${detail.expected}。`;
      break;
    }
    case "unrecognized_keys": {
      const data = issue as unknown as { keys: string[] };
      detail.received = data.keys;
      detail.hint = `移除未识别的字段：${data.keys.join(", ")}。`;
      break;
    }
    case "custom": {
      const params = (issue as unknown as { params?: Record<string, unknown> }).params ?? {};
      if (params.severity === "warning") {
        detail.severity = "warning";
      }
      detail.hint = typeof params.hint === "string" ? params.hint : "请检查自定义校验逻辑。";
      if (typeof params.expected === "string") {
        detail.expected = params.expected;
      }
      break;
    }
    case "invalid_union": {
      detail.hint = "联合类型校验失败，请检查各候选配置对象的约束。";
      break;
    }
    default: {
      detail.hint = "请根据错误信息检查并修复配置。";
      break;
    }
  }

  if (!detail.hint) {
    detail.hint = "请根据错误信息检查并修复配置。";
  }

  return detail;
}

function buildRangeExpectation(
  label: "最低" | "最高",
  value: number | bigint | undefined,
  type: string,
  inclusive: boolean
): string {
  if (value === undefined) {
    return `${label}值符合要求`;
  }

  let comparator: "≥" | ">" | "≤" | "<";
  if (label === "最低") {
    comparator = inclusive ? "≥" : ">";
  } else {
    comparator = inclusive ? "≤" : "<";
  }
  const labelByType: Record<string, string> = {
    array: "元素数量",
    string: "长度",
    bigint: "数值",
  };
  const readableType = labelByType[type] ?? "数值";

  return `${readableType} ${comparator} ${String(value)}`;
}

/**
 * 生成 JSON Schema
 */
export function generateJsonSchema() {
  // 使用自定义方法生成 JSON Schema，因为 Zod 的 toJSON 在某些版本中不可用
  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
      environment: {
        type: "string",
        enum: ["development", "staging", "production"],
        description: "环境标识符",
      },
      event: {
        type: "object",
        properties: {
          batchSize: { type: "number", minimum: 1, description: "批处理大小" },
          batchInterval: { type: "number", minimum: 0, description: "批处理间隔 (ms)" },
          maxQueueSize: { type: "number", minimum: 1, description: "最大队列大小" },
          enableDedup: { type: "boolean", description: "启用去重" },
          concurrencyLimit: { type: "number", minimum: 1, description: "并发限制" },
          maxListeners: { type: "number", minimum: 1, description: "最大监听器数量" },
        },
        required: [
          "batchSize",
          "batchInterval",
          "maxQueueSize",
          "enableDedup",
          "concurrencyLimit",
          "maxListeners",
        ],
        additionalProperties: false,
      },
      render: {
        type: "object",
        properties: {
          frameRate: { type: "number", minimum: 1, maximum: 240, description: "目标帧率" },
          cacheTTL: { type: "number", minimum: 0, description: "缓存TTL (ms)" },
          maxCacheSize: { type: "number", minimum: 1, description: "最大缓存条目数" },
          defaultRenderer: {
            type: "string",
            enum: ["react", "canvas", "webgpu"],
            description: "默认渲染器",
          },
          enableDirtyRegion: { type: "boolean", description: "启用脏区域优化" },
          constants: {
            type: "object",
            properties: {
              SMALL: { type: "number", minimum: 0 },
              MEDIUM: { type: "number", minimum: 0 },
              LARGE: { type: "number", minimum: 0 },
            },
            required: ["SMALL", "MEDIUM", "LARGE"],
            additionalProperties: false,
          },
        },
        required: [
          "frameRate",
          "cacheTTL",
          "maxCacheSize",
          "defaultRenderer",
          "enableDirtyRegion",
          "constants",
        ],
        additionalProperties: false,
      },
      entity: {
        type: "object",
        properties: {
          maxEntities: { type: "number", minimum: 1, description: "最大实体数量" },
          gcInterval: { type: "number", minimum: 1000, description: "GC间隔 (ms)" },
          enableEntityPool: { type: "boolean", description: "启用实体池" },
        },
        required: ["maxEntities", "gcInterval", "enableEntityPool"],
        additionalProperties: false,
      },
      performance: {
        type: "object",
        properties: {
          enableProfiling: { type: "boolean", description: "启用性能分析" },
          metricsInterval: { type: "number", minimum: 100, description: "指标收集间隔 (ms)" },
          enableVerboseLogging: { type: "boolean", description: "启用详细日志" },
        },
        required: ["enableProfiling", "metricsInterval", "enableVerboseLogging"],
        additionalProperties: false,
      },
      tenant: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "启用多租户" },
          defaultQuota: {
            type: "object",
            properties: {
              maxEntities: { type: "number", minimum: 1 },
              maxFlows: { type: "number", minimum: 1 },
              storageLimit: { type: "number", minimum: 1 },
            },
            required: ["maxEntities", "maxFlows", "storageLimit"],
            additionalProperties: false,
          },
        },
        required: ["enabled", "defaultQuota"],
        additionalProperties: false,
      },
      plugin: {
        type: "object",
        properties: {
          sandboxTimeout: { type: "number", minimum: 100, description: "沙盒运行器超时 (ms)" },
          capabilityCache: {
            type: "object",
            properties: {
              enabled: { type: "boolean" },
              defaultTtlMs: { type: "number", minimum: 1000 },
              maxSize: { type: "number", minimum: 1 },
            },
            required: ["enabled", "defaultTtlMs", "maxSize"],
            additionalProperties: false,
          },
          execution: {
            type: "object",
            properties: {
              defaultTimeoutMs: { type: "number", minimum: 100 },
              maxRetries: { type: "number", minimum: 0 },
            },
            required: ["defaultTimeoutMs", "maxRetries"],
            additionalProperties: false,
          },
        },
        required: ["sandboxTimeout", "capabilityCache", "execution"],
        additionalProperties: false,
      },
    },
    required: ["environment", "event", "render", "entity", "performance", "plugin"],
    additionalProperties: false,
  };

  // 在开发环境中自动生成文件
  if (
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env.NODE_ENV !== "production"
  ) {
    // 使用动态导入避免在浏览器环境中出错
    import("fs")
      .then((fs) => {
        const schemaPath = "./config/schema/duckflow.schema.json";
        const tsPath = "./config/schema/duckflow.schema.d.ts";

        fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
        console.log("✅ Generated duckflow.schema.json");

        const tsDeclaration = `/**
 * DuckFlow Configuration TypeScript Declarations
 *
 * Generated from Zod schema - DO NOT EDIT MANUALLY
 */

export interface DuckFlowConfig {
  environment: "development" | "staging" | "production";
  event: {
    batchSize: number;
    batchInterval: number;
    maxQueueSize: number;
    enableDedup: boolean;
    concurrencyLimit: number;
    maxListeners: number;
  };
  render: {
    frameRate: number;
    cacheTTL: number;
    maxCacheSize: number;
    defaultRenderer: "react" | "canvas" | "webgpu";
    enableDirtyRegion: boolean;
    constants: {
      SMALL: number;
      MEDIUM: number;
      LARGE: number;
    };
  };
  entity: {
    maxEntities: number;
    gcInterval: number;
    enableEntityPool: boolean;
  };
  performance: {
    enableProfiling: boolean;
    metricsInterval: number;
    enableVerboseLogging: boolean;
  };
  tenant?: {
    enabled: boolean;
    defaultQuota: {
      maxEntities: number;
      maxFlows: number;
      storageLimit: number;
    };
  };
  plugin: {
    sandboxTimeout: number;
    capabilityCache: {
      enabled: boolean;
      defaultTtlMs: number;
      maxSize: number;
    };
    execution: {
      defaultTimeoutMs: number;
      maxRetries: number;
    };
  };
}
`;
        fs.writeFileSync(tsPath, tsDeclaration);
        console.log("✅ Generated duckflow.schema.d.ts");
      })
      .catch(() => {
        // 忽略文件系统不可用的错误（浏览器环境）
      });
  }

  return schema;
}
