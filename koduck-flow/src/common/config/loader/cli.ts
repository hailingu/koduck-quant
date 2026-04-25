import type { DuckFlowConfig } from "../schema";

import { hasProcessEnv, isBrowserEnv } from "./constants";
import { mergeRuntimeObjects } from "./runtime";

export function loadOverridesFromCLI(): Partial<DuckFlowConfig> {
  if (isBrowserEnv || !hasProcessEnv || !process.argv) {
    return {};
  }

  const cliConfig: Partial<DuckFlowConfig> = {};
  const args = process.argv.slice(2);

  const toggleHandlers: Record<string, () => void> = {
    "--enable-profiling": () => {
      cliConfig.performance = mergeRuntimeObjects(cliConfig.performance ?? {}, {
        enableProfiling: true,
      }) as DuckFlowConfig["performance"];
    },
    "--enable-verbose-logging": () => {
      cliConfig.performance = mergeRuntimeObjects(cliConfig.performance ?? {}, {
        enableVerboseLogging: true,
      }) as DuckFlowConfig["performance"];
    },
  };

  const numericHandlers: Record<string, (value: number) => void> = {
    "--event-batch-size": (value: number) => {
      cliConfig.event = mergeRuntimeObjects(cliConfig.event ?? {}, {
        batchSize: value,
      }) as DuckFlowConfig["event"];
    },
    "--event-batch-interval": (value: number) => {
      cliConfig.event = mergeRuntimeObjects(cliConfig.event ?? {}, {
        batchInterval: value,
      }) as DuckFlowConfig["event"];
    },
    "--render-frame-rate": (value: number) => {
      cliConfig.render = mergeRuntimeObjects(cliConfig.render ?? {}, {
        frameRate: value,
      }) as DuckFlowConfig["render"];
    },
    "--render-cache-ttl": (value: number) => {
      cliConfig.render = mergeRuntimeObjects(cliConfig.render ?? {}, {
        cacheTTL: value,
      }) as DuckFlowConfig["render"];
    },
  };

  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--env" && next) {
      cliConfig.environment = next as "development" | "staging" | "production";
      index += 2;
      continue;
    }

    const numericHandler = numericHandlers[arg];
    if (numericHandler && next) {
      numericHandler(Number.parseInt(next, 10));
      index += 2;
      continue;
    }

    const toggleHandler = toggleHandlers[arg];
    if (toggleHandler) {
      toggleHandler();
      index += 1;
      continue;
    }

    index += 1;
  }

  return cliConfig;
}
