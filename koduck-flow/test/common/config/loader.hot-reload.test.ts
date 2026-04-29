import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import type { KoduckFlowConfig } from "../../../src/common/config/schema";
import type { ConfigChangeContext } from "../../../src/common/config/loader/types";
import { ConfigLoader } from "../../../src/common/config/loader";

describe("Hot Reload Integration", () => {
  let loader: ConfigLoader;
  let testConfigPath: string;
  let originalConfig: Partial<KoduckFlowConfig>;

  beforeEach(() => {
    loader = ConfigLoader.getInstance();
    // Create temporary config file
    testConfigPath = path.join(process.cwd(), "koduckflow.config.json");
    originalConfig = {
      environment: "development" as const,
      render: {
        frameRate: 60,
        cacheTTL: 5000,
        maxCacheSize: 100,
        defaultRenderer: "react" as const,
        enableDirtyRegion: false,
        constants: {
          SMALL: 10,
          MEDIUM: 20,
          LARGE: 30,
        },
      },
      event: {
        batchSize: 10,
        batchInterval: 100,
        maxQueueSize: 1000,
        enableDedup: true,
        concurrencyLimit: 5,
        maxListeners: 100,
      },
      entity: {
        maxEntities: 1000,
        gcInterval: 30000,
        enableEntityPool: true,
      },
      performance: {
        enableProfiling: true,
        metricsInterval: 5000,
        enableVerboseLogging: false,
      },
      plugin: {
        sandboxTimeout: 5000,
        capabilityCache: {
          enabled: true,
          defaultTtlMs: 300000,
          maxSize: 100,
        },
        execution: {
          defaultTimeoutMs: 30000,
          maxRetries: 3,
        },
      },
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(originalConfig, null, 2));
  });

  afterEach(() => {
    // Clean up temporary file and disable hot reload
    try {
      loader.disableHotReload();
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }
    } catch {
    // Ignore cleanup errors
    }
  });

  describe("File Watcher Integration", () => {
    it("should enable hot reload and watch config file", () => {
    // Enable hot reload
      loader.enableHotReload();

    // Verify hot reload is enabled
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(true);
    });

    it("should disable hot reload and stop watching", () => {
    // Enable first
      loader.enableHotReload();
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(true);

    // Then disable
      loader.disableHotReload();
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(false);
    });

    it("should reload configuration when file changes", async () => {
    // Enable hot reload
      loader.enableHotReload();

    // Wait for file watcher setup
      await new Promise((resolve) => setTimeout(resolve, 100));

    // Modify config file
      const newConfig = {
        ...originalConfig,
        render: {
          ...originalConfig.render!,
          maxCacheSize: 200,
          enableDirtyRegion: true,
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(newConfig, null, 2));

    // Wait for file change to be detected and reloaded
      await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify config has been updated
      const currentConfig = loader.load();
      expect(currentConfig.render.maxCacheSize).toBe(200);
      expect(currentConfig.render.enableDirtyRegion).toBe(true);
    });

    it("should handle invalid config file gracefully", async () => {
    // Enable hot reload
      loader.enableHotReload();

    // Wait for file watcher setup
      await new Promise((resolve) => setTimeout(resolve, 100));

    // Get initial config
      const initialConfig = loader.load();

    // Write invalid JSON
      fs.writeFileSync(testConfigPath, "{ invalid json }");

    // Wait for file change to be detected
      await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify config has not changed (invalid JSON should be ignored)
      const currentConfig = loader.load();
      expect(currentConfig.render.maxCacheSize).toBe(initialConfig.render.maxCacheSize);
    });

    it("should handle file deletion gracefully", async () => {
    // Enable hot reload
      loader.enableHotReload();

    // Wait for file watcher setup
      await new Promise((resolve) => setTimeout(resolve, 100));

    // Get initial config
      const initialConfig = loader.load();

    // Delete config file
      fs.unlinkSync(testConfigPath);

    // Wait for file change to be detected
      await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify config has not changed (file deletion should be ignored)
      const currentConfig = loader.load();
      expect(currentConfig.render.maxCacheSize).toBe(initialConfig.render.maxCacheSize);
    });

    it("should not enable hot reload in browser environment", () => {
      // Mock browser environment by setting a test flag
      (global as unknown as { __KODUCKFLOW_TEST_BROWSER_ENV: boolean }).__KODUCKFLOW_TEST_BROWSER_ENV =
        true;

      try {
        loader.enableHotReload();
        expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(false);
      } finally {
    // Restore original environment
        delete (global as unknown as { __KODUCKFLOW_TEST_BROWSER_ENV?: boolean })
          .__KODUCKFLOW_TEST_BROWSER_ENV;
      }
    });

    it("should handle multiple enable/disable calls", () => {
    // Multiple enables
      loader.enableHotReload();
      loader.enableHotReload();
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(true);

    // Multiple disables
      loader.disableHotReload();
      loader.disableHotReload();
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(false);
    });
  });

  describe("Configuration Reload Context", () => {
    it("should provide correct reload context for file changes", async () => {
      let capturedContext: ConfigChangeContext | undefined;

    // Mock config change listener
      const originalReload = loader.reload.bind(loader);
      const mockReload = vi.fn(
        (options?: Partial<KoduckFlowConfig>, context?: ConfigChangeContext) => {
          capturedContext = context;
          return originalReload(options, context);
        }
      );
      (loader as unknown as { reload: typeof mockReload }).reload = mockReload;

      try {
    // Enable hot reload
        loader.enableHotReload();

    // Wait for file watcher setup
        await new Promise((resolve) => setTimeout(resolve, 100));

    // Modify config file
        const newConfig = {
          ...originalConfig,
          render: {
            ...originalConfig.render!,
            maxCacheSize: 300,
          },
        };

        fs.writeFileSync(testConfigPath, JSON.stringify(newConfig, null, 2));

    // Wait for file change to be detected
        await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify reload was called and context is correct
        expect(mockReload).toHaveBeenCalled();
        expect(capturedContext).toBeDefined();
        expect(capturedContext!.trigger).toBe("file-watcher");
        expect(capturedContext!.metadata).toBeDefined();
        expect((capturedContext!.metadata as { path: string }).path).toBe(testConfigPath);
      } finally {
    // Restore original method
        (loader as unknown as { reload: typeof originalReload }).reload = originalReload;
      }
    });
  });
});
