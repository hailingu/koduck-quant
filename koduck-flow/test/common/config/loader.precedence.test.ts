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

describe("ConfigLoader source precedence", () => {
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

  it("prefers runtime overrides over env, env over file, and file over defaults", () => {
    const fileConfig = {
      render: {
        frameRate: 42,
        cacheTTL: 250_000,
      },
      plugin: {
        sandboxTimeout: 7_000,
      },
      event: {
        batchSize: 24,
      },
    } as Partial<KoduckFlowConfig>;

    const loadFileSpy = vi.spyOn(sources, "loadConfigFile").mockReturnValue(fileConfig);

    setEnv("KODUCKFLOW_RENDER_FRAME_RATE", "55");
    setEnv("KODUCKFLOW_PLUGIN_SANDBOX_TIMEOUT", "9000");

    const loader = getConfigLoader();
    const initial = loader.load();

    expect(initial.render.frameRate).toBe(55);
    expect(initial.plugin?.sandboxTimeout).toBe(9000);
    expect(initial.event.batchSize).toBe(24);
    expect(loadFileSpy).toHaveBeenCalled();

    const runtimeResult = loader.applyRuntimeOverrides(
      {
        render: {
          frameRate: 66,
        },
      } as Partial<KoduckFlowConfig>,
      { source: "api" }
    );

    expect(runtimeResult.config.render.frameRate).toBe(66);
    expect(runtimeResult.config.plugin?.sandboxTimeout).toBe(9000);
    expect(runtimeResult.config.event.batchSize).toBe(24);
  });

  it("throws when env value fails validation", () => {
    vi.spyOn(sources, "loadConfigFile").mockReturnValue({});
    setEnv("KODUCKFLOW_EVENT_BATCH_SIZE", "not-a-number");

    const loader = getConfigLoader();
    expect(() => loader.load()).toThrowError(/Failed to apply KODUCKFLOW_EVENT_BATCH_SIZE/);
  });
});
