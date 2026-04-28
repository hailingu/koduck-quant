import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigLoader, getConfigLoader } from "../../../src/common/config/loader";
import type { KoduckFlowConfig } from "../../../src/common/config/schema";
import * as sources from "../../../src/common/config/loader/sources";

function getCurrentLoaderInstance(): ConfigLoader | undefined {
  return Reflect.get(ConfigLoader, "instance") as ConfigLoader | undefined;
}

function disposeLoader(): void {
  const current = getCurrentLoaderInstance();
  if (current) {
    current.shutdownHTTPOverrides();
    current.disableHotReload();
  }
  Reflect.set(ConfigLoader, "instance", undefined);
}

describe("ConfigLoader regression scenarios", () => {
  const envKeys: string[] = [];

  function setEnv(key: string, value: string): void {
    process.env[key] = value;
    envKeys.push(key);
  }

  beforeEach(() => {
    disposeLoader();
  });

  afterEach(() => {
    disposeLoader();
    for (const key of envKeys.splice(0, envKeys.length)) {
      delete process.env[key];
    }
    vi.restoreAllMocks();
  });

  describe("invalid ranges and constraints", () => {
    it("rejects negative batchSize", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_EVENT_BATCH_SIZE", "-1");

      const loader = getConfigLoader();
      expect(() => loader.load()).toThrowError(/Invalid configuration/);
    });

    it("rejects zero concurrencyLimit", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_EVENT_CONCURRENCY_LIMIT", "0");

      const loader = getConfigLoader();
      expect(() => loader.load()).toThrowError(/Invalid configuration/);
    });

    it("rejects negative cacheTTL", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_RENDER_CACHE_TTL", "-1000");

      const loader = getConfigLoader();
      expect(() => loader.load()).toThrowError(/Invalid configuration/);
    });

    it("rejects invalid environment enum", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_ENVIRONMENT", "invalid-env");

      const loader = getConfigLoader();
      expect(() => loader.load()).toThrowError(/Failed to apply KODUCKFLOW_ENVIRONMENT/);
    });

    it("rejects invalid renderer enum", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_RENDER_DEFAULT_RENDERER", "invalid-renderer");

      const loader = getConfigLoader();
      expect(() => loader.load()).toThrowError(/Failed to apply KODUCKFLOW_RENDER_DEFAULT_RENDERER/);
    });
  });

  describe("missing files and sources", () => {
    it("handles missing config file gracefully", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);

      const loader = getConfigLoader();
      const config = loader.load();

      expect(config).toBeDefined();
      expect(config.environment).toBe("development");
    });

    it("handles malformed JSON in config file", () => {
      vi.spyOn(sources, "loadConfigFile").mockImplementation(() => {
        throw new Error("Invalid JSON");
      });

      const loader = getConfigLoader();
      expect(() => loader.load()).toThrowError(/Invalid JSON/);
    });

    it("handles missing environment variables", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({
        render: { frameRate: 60 },
      } as Partial<KoduckFlowConfig>);

      const loader = getConfigLoader();
      const config = loader.load();

      expect(config.render.frameRate).toBe(60);
      expect(config.event.batchSize).toBe(10); // default value
    });
  });

  describe("environment variable overrides", () => {
    it("overrides boolean values correctly", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({
        event: { enableDedup: true },
      } as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_EVENT_ENABLE_DEDUP", "false");

      const loader = getConfigLoader();
      const config = loader.load();

      expect(config.event.enableDedup).toBe(false);
    });

    it("overrides number values correctly", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({
        render: { maxCacheSize: 1024 },
      } as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_RENDER_MAX_CACHE_SIZE", "2048");

      const loader = getConfigLoader();
      const config = loader.load();

      expect(config.render.maxCacheSize).toBe(2048);
    });

    it("overrides enum values correctly", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({
        render: { defaultRenderer: "react" },
      } as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_RENDER_DEFAULT_RENDERER", "canvas");

      const loader = getConfigLoader();
      const config = loader.load();

      expect(config.render.defaultRenderer).toBe("canvas");
    });

    it("handles invalid env var values gracefully", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_EVENT_BATCH_SIZE", "not-a-number");

      const loader = getConfigLoader();
      expect(() => loader.load()).toThrowError(/Failed to apply KODUCKFLOW_EVENT_BATCH_SIZE/);
    });

    it("ignores unknown environment variables", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);
      setEnv("UNKNOWN_VAR", "some-value");

      const loader = getConfigLoader();
      const config = loader.load();

      expect(config).toBeDefined();
      // Should not affect config
    });
  });

  describe("precedence edge cases", () => {
    it("runtime overrides take precedence over env vars", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({
        render: { frameRate: 30 },
      } as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_RENDER_FRAME_RATE", "45");

      const loader = getConfigLoader();
      const initial = loader.load();

      expect(initial.render.frameRate).toBe(45);

      const runtimeResult = loader.applyRuntimeOverrides(
        { render: { frameRate: 60 } } as Partial<KoduckFlowConfig>,
        { source: "api" }
      );

      expect(runtimeResult.config.render.frameRate).toBe(60);
    });

    it("handles partial runtime overrides", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({
        event: { batchSize: 8, batchInterval: 100 },
      } as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_EVENT_BATCH_SIZE", "16");

      const loader = getConfigLoader();
      const initial = loader.load();

      expect(initial.event.batchSize).toBe(16);
      expect(initial.event.batchInterval).toBe(100);

      const runtimeResult = loader.applyRuntimeOverrides(
        { event: { batchSize: 32 } } as Partial<KoduckFlowConfig>,
        { source: "api" }
      );

      expect(runtimeResult.config.event.batchSize).toBe(32);
      expect(runtimeResult.config.event.batchInterval).toBe(100); // unchanged
    });
  });

  describe("error messaging", () => {
    it("provides detailed error for invalid env var", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_EVENT_BATCH_SIZE", "invalid");

      const loader = getConfigLoader();
      expect(() => loader.load()).toThrowError(
        /Environment variable KODUCKFLOW_EVENT_BATCH_SIZE expects a numeric value/
      );
    });

    it("handles multiple validation errors", () => {
      vi.spyOn(sources, "loadConfigFile").mockReturnValue({} as Partial<KoduckFlowConfig>);
      setEnv("KODUCKFLOW_EVENT_BATCH_SIZE", "-1");
      setEnv("KODUCKFLOW_EVENT_CONCURRENCY_LIMIT", "0");

      const loader = getConfigLoader();
      expect(() => loader.load()).toThrowError(/Invalid configuration/);
    });
  });
});
