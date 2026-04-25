import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRealtimeSyncPlugin } from "../../../src/common/plugin/realtime-sync-plugin";

describe("RealtimeSyncPlugin", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes lifecycle handlers", () => {
    const lifecycle = createRealtimeSyncPlugin();

    expect(typeof lifecycle.onInit).toBe("function");
    expect(typeof lifecycle.onAttach).toBe("function");
    expect(typeof lifecycle.onDispose).toBe("function");
  });

  it("logs feature flag metadata during init", async () => {
    const consoleDebug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const lifecycle = createRealtimeSyncPlugin();

    await lifecycle.onInit?.({ metadata: { featureFlag: "beta-sync" } });

    expect(consoleDebug).toHaveBeenCalledWith(
      "[RealtimeSyncPlugin] init feature flag",
      "beta-sync"
    );
  });

  it("attaches to runtime and records info log", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const lifecycle = createRealtimeSyncPlugin();

    await lifecycle.onAttach?.({ runtimeId: "runtime-42" });

    expect(consoleInfo).toHaveBeenCalledWith(
      "[RealtimeSyncPlugin] attached to runtime",
      "runtime-42"
    );
  });

  it("disposes with default reason when none provided", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const lifecycle = createRealtimeSyncPlugin();

    await lifecycle.onDispose?.({});

    expect(consoleInfo).toHaveBeenCalledWith("[RealtimeSyncPlugin] disposed", "normal");
  });

  it("disposes with explicit reason when provided", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const lifecycle = createRealtimeSyncPlugin();

    await lifecycle.onDispose?.({ reason: "shutdown" });

    expect(consoleInfo).toHaveBeenCalledWith("[RealtimeSyncPlugin] disposed", "shutdown");
  });

  it("does not log feature flag when metadata absent", async () => {
    const consoleDebug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const lifecycle = createRealtimeSyncPlugin();

    await lifecycle.onInit?.({ metadata: {} });

    expect(consoleDebug).not.toHaveBeenCalled();
  });
});
