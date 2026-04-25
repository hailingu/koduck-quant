import fs from "fs";

import type { DuckFlowConfig } from "../schema";

import { hasProcessEnv, isBrowserEnv } from "./constants";
import { ENV_VAR_DEFINITIONS, applyEnvVar } from "./env-definitions";

export function loadDefaults(): DuckFlowConfig {
  return {
    environment: "development",
    event: {
      batchSize: 10,
      batchInterval: 100,
      maxQueueSize: 1000,
      enableDedup: true,
      concurrencyLimit: 4,
      maxListeners: 1000,
    },
    render: {
      frameRate: 60,
      cacheTTL: 5 * 60 * 1000,
      maxCacheSize: 1000,
      defaultRenderer: "react",
      enableDirtyRegion: true,
      constants: {
        SMALL: 100,
        MEDIUM: 1000,
        LARGE: 5000,
      },
    },
    entity: {
      maxEntities: 10000,
      gcInterval: 5 * 60 * 1000,
      enableEntityPool: true,
    },
    performance: {
      enableProfiling: false,
      metricsInterval: 5000,
      enableVerboseLogging: false,
    },
    plugin: {
      sandboxTimeout: 5000,
      capabilityCache: {
        enabled: true,
        defaultTtlMs: 300000,
        maxSize: 1000,
      },
      execution: {
        defaultTimeoutMs: 5000,
        maxRetries: 3,
      },
    },
  } satisfies DuckFlowConfig;
}

export function loadConfigFile(): Partial<DuckFlowConfig> {
  if (isBrowserEnv) {
    return {};
  }

  const { readFileSync, existsSync } = fs;
  const configPaths = [
    "./duckflow.config.json",
    "./config/duckflow.config.json",
    "./src/config/duckflow.config.json",
  ];

  for (const configPath of configPaths) {
    try {
      if (existsSync(configPath)) {
        const configData = readFileSync(configPath, "utf-8");
        const config = JSON.parse(configData);
        if (config && typeof config === "object") {
          return config as Partial<DuckFlowConfig>;
        }
      }
    } catch {
      // ignore missing file or parse errors
    }
  }

  return {};
}

export function loadEnvConfig(): Partial<DuckFlowConfig> {
  if (!hasProcessEnv) {
    return {};
  }

  const envConfig: Partial<DuckFlowConfig> = {};

  for (const definition of ENV_VAR_DEFINITIONS) {
    const rawValue = process.env[definition.name];
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }

    try {
      applyEnvVar(envConfig, definition, rawValue);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to apply ${definition.name}: ${message}`);
    }
  }

  return envConfig;
}
