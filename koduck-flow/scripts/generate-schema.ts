#!/usr/bin/env tsx

/**
 * KoduckFlow 配置 Schema 生成脚本
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateJsonSchema } from "../src/common/config/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configDir = resolve(__dirname, "../config/schema");

mkdirSync(configDir, { recursive: true });

const jsonSchemaPath = resolve(configDir, "koduckflow.schema.json");
const declarationPath = resolve(configDir, "koduckflow.schema.d.ts");

const schema = generateJsonSchema();
writeFileSync(jsonSchemaPath, JSON.stringify(schema, null, 2));
console.log("✅ Generated koduckflow.schema.json");

const declaration = `/**
 * KoduckFlow Configuration TypeScript Declarations
 *
 * Generated from Zod schema - DO NOT EDIT MANUALLY
 */

export interface KoduckFlowConfig {
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

writeFileSync(declarationPath, declaration);
console.log("✅ Generated koduckflow.schema.d.ts");

console.log("🎉 Schema generation completed!");
