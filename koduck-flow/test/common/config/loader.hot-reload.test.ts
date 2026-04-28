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
    // 创建临时配置文件
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
    // 清理临时文件和禁用hot reload
    try {
      loader.disableHotReload();
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }
    } catch {
      // 忽略清理错误
    }
  });

  describe("File Watcher Integration", () => {
    it("should enable hot reload and watch config file", () => {
      // 启用hot reload
      loader.enableHotReload();

      // 验证hot reload已启用
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(true);
    });

    it("should disable hot reload and stop watching", () => {
      // 先启用
      loader.enableHotReload();
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(true);

      // 再禁用
      loader.disableHotReload();
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(false);
    });

    it("should reload configuration when file changes", async () => {
      // 启用hot reload
      loader.enableHotReload();

      // 等待文件监听器设置
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 修改配置文件
      const newConfig = {
        ...originalConfig,
        render: {
          ...originalConfig.render!,
          maxCacheSize: 200,
          enableDirtyRegion: true,
        },
      };

      fs.writeFileSync(testConfigPath, JSON.stringify(newConfig, null, 2));

      // 等待文件变化被检测到和重新加载
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 验证配置已更新
      const currentConfig = loader.load();
      expect(currentConfig.render.maxCacheSize).toBe(200);
      expect(currentConfig.render.enableDirtyRegion).toBe(true);
    });

    it("should handle invalid config file gracefully", async () => {
      // 启用hot reload
      loader.enableHotReload();

      // 等待文件监听器设置
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 获取初始配置
      const initialConfig = loader.load();

      // 写入无效的JSON
      fs.writeFileSync(testConfigPath, "{ invalid json }");

      // 等待文件变化被检测到
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 验证配置没有改变（因为无效JSON应该被忽略）
      const currentConfig = loader.load();
      expect(currentConfig.render.maxCacheSize).toBe(initialConfig.render.maxCacheSize);
    });

    it("should handle file deletion gracefully", async () => {
      // 启用hot reload
      loader.enableHotReload();

      // 等待文件监听器设置
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 获取初始配置
      const initialConfig = loader.load();

      // 删除配置文件
      fs.unlinkSync(testConfigPath);

      // 等待文件变化被检测到
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 验证配置没有改变（因为文件删除应该被忽略）
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
        // 恢复原始环境
        delete (global as unknown as { __KODUCKFLOW_TEST_BROWSER_ENV?: boolean })
          .__KODUCKFLOW_TEST_BROWSER_ENV;
      }
    });

    it("should handle multiple enable/disable calls", () => {
      // 多次启用
      loader.enableHotReload();
      loader.enableHotReload();
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(true);

      // 多次禁用
      loader.disableHotReload();
      loader.disableHotReload();
      expect((loader as unknown as { hotReloadEnabled: boolean }).hotReloadEnabled).toBe(false);
    });
  });

  describe("Configuration Reload Context", () => {
    it("should provide correct reload context for file changes", async () => {
      let capturedContext: ConfigChangeContext | undefined;

      // Mock配置变更监听器
      const originalReload = loader.reload.bind(loader);
      const mockReload = vi.fn(
        (options?: Partial<KoduckFlowConfig>, context?: ConfigChangeContext) => {
          capturedContext = context;
          return originalReload(options, context);
        }
      );
      (loader as unknown as { reload: typeof mockReload }).reload = mockReload;

      try {
        // 启用hot reload
        loader.enableHotReload();

        // 等待文件监听器设置
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 修改配置文件
        const newConfig = {
          ...originalConfig,
          render: {
            ...originalConfig.render!,
            maxCacheSize: 300,
          },
        };

        fs.writeFileSync(testConfigPath, JSON.stringify(newConfig, null, 2));

        // 等待文件变化被检测到
        await new Promise((resolve) => setTimeout(resolve, 200));

        // 验证reload被调用且上下文正确
        expect(mockReload).toHaveBeenCalled();
        expect(capturedContext).toBeDefined();
        expect(capturedContext!.trigger).toBe("file-watcher");
        expect(capturedContext!.metadata).toBeDefined();
        expect((capturedContext!.metadata as { path: string }).path).toBe(testConfigPath);
      } finally {
        // 恢复原始方法
        (loader as unknown as { reload: typeof originalReload }).reload = originalReload;
      }
    });
  });
});
