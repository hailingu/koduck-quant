import fs from "fs";
import path from "path";
import type { FSWatcher } from "node:fs";

import { logger } from "../../logger";
import { isBrowserEnv } from "./constants";
import { configEventEmitter } from "./config-event-emitter";

interface HotReloadState {
  fileWatcher: FSWatcher | null;
  hotReloadEnabled: boolean;
}

const CONFIG_PATHS = [
  "./duckflow.config.json",
  "./config/duckflow.config.json",
  "./src/config/duckflow.config.json",
];

export function enableHotReloadImpl(state: HotReloadState): void {
  if (
    isBrowserEnv ||
    (global as unknown as { __DUCKFLOW_TEST_BROWSER_ENV?: boolean }).__DUCKFLOW_TEST_BROWSER_ENV
  )
    return;
  if (state.hotReloadEnabled) return;

  state.hotReloadEnabled = true;
  setupFileWatcher(state);
  logger.info("Hot reload enabled for configuration files");
}

export function disableHotReloadImpl(state: HotReloadState): void {
  if (isBrowserEnv) return;
  if (!state.hotReloadEnabled) return;

  state.hotReloadEnabled = false;
  cleanupFileWatcher(state);
  logger.info("Hot reload disabled");
}

function setupFileWatcher(state: HotReloadState): void {
  const { watch, existsSync } = fs;

  const existingConfigPath = CONFIG_PATHS.find((path) => existsSync(path));
  if (!existingConfigPath) return;

  // Convert to absolute path for metadata
  const absoluteConfigPath = path.resolve(existingConfigPath);

  state.fileWatcher = watch(existingConfigPath, { persistent: false }, (eventType: string) => {
    if (eventType === "change") {
      logger.info(`Configuration file ${existingConfigPath} changed, reloading...`);
      try {
        // Validate file content before reloading
        const { readFileSync, existsSync } = fs;
        if (existsSync(existingConfigPath)) {
          const configData = readFileSync(existingConfigPath, "utf-8");
          JSON.parse(configData); // Validate JSON
        }

        // Emit reload event instead of direct call
        configEventEmitter.emit("reload", {
          context: {
            trigger: "file-watcher",
            metadata: { path: absoluteConfigPath },
          },
        });
      } catch (error) {
        logger.warn(
          `Configuration file ${existingConfigPath} contains invalid JSON, skipping reload:`,
          error
        );
      }
    }
  });
}

function cleanupFileWatcher(state: HotReloadState): void {
  if (state.fileWatcher) {
    state.fileWatcher.close();
    state.fileWatcher = null;
  }
}
