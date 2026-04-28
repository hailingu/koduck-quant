import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigLoader, getConfigLoader } from "../../../src/common/config/loader";
import type { KoduckFlowConfig } from "../../../src/common/config/schema";

const HTTP_OVERRIDE_PATH = "/api/config/override";

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

async function postJson(
  port: number,
  path: string,
  payload: unknown
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`http://localhost:${port}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  return { status: response.status, body };
}

describe("ConfigLoader runtime overrides", () => {
  beforeEach(() => {
    disposeLoader();
  });

  afterEach(() => {
    disposeLoader();
  });

  it("keeps internal fields reachable for bundlers", () => {
    const loader = getConfigLoader();
    const internal = loader as unknown as { assertInternalUsage: () => void };
    expect(() => internal.assertInternalUsage()).not.toThrow();
  });

  it("evaluates overrides in dry-run mode without mutating loader state", () => {
    const loader = getConfigLoader();

    const result = loader.applyRuntimeOverrides(
      {
        event: {
          batchSize: 48,
        },
      } as Partial<KoduckFlowConfig>,
      {
        source: "api",
        dryRun: true,
        actor: "test-suite",
      }
    );

    expect(result.dryRun).toBe(true);
    expect((result.config as KoduckFlowConfig).event.batchSize).toBe(48);
    expect(loader.getRuntimeOverrides()).to.deep.equal({});
    const [lastAudit] = loader.getRuntimeAuditTrail(1);
    expect(lastAudit?.dryRun).toBe(true);
    expect(loader.load().event.batchSize).not.toBe(48);
  });

  it("applies overrides and notifies listeners", () => {
    const loader = getConfigLoader();
    const spy = vi.fn();
    loader.onConfigChange(spy);

    const result = loader.applyRuntimeOverrides(
      {
        performance: {
          enableProfiling: true,
        },
      } as Partial<KoduckFlowConfig>,
      {
        source: "api",
        actor: "integration",
      }
    );

    expect(result.dryRun).toBe(false);
    expect((result.config as KoduckFlowConfig).performance.enableProfiling).toBe(true);
    const overrides = loader.getRuntimeOverrides();
    expect(overrides.performance?.enableProfiling).toBe(true);
    expect(loader.load().performance.enableProfiling).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    loader.offConfigChange(spy);
  });

  it("accepts HTTP overrides and persists them", async () => {
    const loader = getConfigLoader();
    loader.setupHTTPOverrides(0);

    // 等待端口分配，确保实际监听端口已准备好
    await expect
      .poll(() => loader.getHttpPort())
      .toSatisfy((value): value is number => typeof value === "number" && value > 0);

    const port = loader.getHttpPort();
    expect(typeof port).toBe("number");

    const response = await postJson(port!, HTTP_OVERRIDE_PATH, {
      overrides: {
        render: {
          frameRate: 75,
        },
      },
    });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ success: true, dryRun: false });

    const config = loader.load();
    expect(config.render.frameRate).toBe(75);

    loader.shutdownHTTPOverrides();
  });
});
