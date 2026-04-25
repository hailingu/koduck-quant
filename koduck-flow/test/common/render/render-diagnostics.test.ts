import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const diagnosticsLoggerSpies = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const baseLoggerSpies = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  withContext: vi.fn(() => diagnosticsLoggerSpies),
  child: vi.fn(() => diagnosticsLoggerSpies),
}));

vi.mock("../../../src/common/logger", () => ({
  logger: baseLoggerSpies,
}));

const { diagnostics, setRenderDiagnostics, getRenderDiagnosticsConfig, resetRenderDiagnostics } =
  await import("../../../src/common/render/render-diagnostics");

describe("render diagnostics configuration", () => {
  beforeEach(() => {
    resetRenderDiagnostics();
    Object.values(diagnosticsLoggerSpies).forEach((spy) => spy.mockClear());
    Object.values(baseLoggerSpies).forEach((spy) => spy.mockClear());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges configuration updates and preserves unspecified fields", () => {
    setRenderDiagnostics({ enabled: true, logLevel: "info", sampleRate: 1 });
    setRenderDiagnostics({ logLevel: "error" });

    expect(getRenderDiagnosticsConfig()).toEqual({
      enabled: true,
      logLevel: "error",
      sampleRate: 1,
    });
  });

  it("emits messages respecting level and sampling thresholds", () => {
    setRenderDiagnostics({ enabled: true, logLevel: "warn", sampleRate: 1 });

    diagnostics.info("skip");
    expect(diagnosticsLoggerSpies.info).not.toHaveBeenCalled();

    diagnostics.warn("emit");
    expect(diagnosticsLoggerSpies.warn).toHaveBeenCalledWith("emit");

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0.9).mockReturnValue(0.2);
    setRenderDiagnostics({ logLevel: "debug", sampleRate: 0.5 });

    diagnostics.debug("sampled-out");
    diagnostics.debug("sampled-in");

    expect(diagnosticsLoggerSpies.debug.mock.calls).toEqual([["sampled-in"]]);
    randomSpy.mockRestore();
  });

  it("resets to defaults and stops emitting logs", () => {
    setRenderDiagnostics({ enabled: true, logLevel: "debug", sampleRate: 1 });
    resetRenderDiagnostics();

    diagnostics.error("halt");
    expect(diagnosticsLoggerSpies.error).not.toHaveBeenCalled();
    expect(getRenderDiagnosticsConfig()).toEqual({
      enabled: false,
      logLevel: "warn",
      sampleRate: 1,
    });
  });
});
