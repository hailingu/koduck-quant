import fs from "node:fs";
import path from "node:path";
import type { FSWatcher } from "node:fs";

import { logger } from "../../logger";
import { isBrowserEnv } from "./constants";
import { configEventEmitter } from "./config-event-emitter";

interface HotReloadState {
  fileWatcher: FSWatcher | null;
  hotReloadEnabled: boolean;
}

const CONFIG_PATHS = [
  "./koduckflow.config.json",
  "./config/koduckflow.config.json",
  "./src/config/koduckflow.config.json",
];

/**
 * Enables configuration hot-reload by setting up a file watcher.
 *
 * @param state - Mutable hot-reload state object
 */
export function enableHotReloadImpl(state: HotReloadState): void {
  if (
    isBrowserEnv ||
    (globalThis as unknown as { __KODUCKFLOW_TEST_BROWSER_ENV?: boolean }).__KODUCKFLOW_TEST_BROWSER_ENV
  )
    return;
  if (state.hotReloadEnabled) return;

  state.hotReloadEnabled = true;
  setupFileWatcher(state);
  logger.info("Hot reload enabled for configuration files");
}

/**
 * Disables configuration hot-reload and cleans up the file watcher.
 *
 * @param state - Mutable hot-reload state object
 */
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
