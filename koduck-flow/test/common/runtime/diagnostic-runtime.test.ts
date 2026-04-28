import { beforeEach, describe, expect, it, vi } from "vitest";

const createKoduckFlowRuntimeMock = vi.hoisted(() => vi.fn());
const loggerMock = vi.hoisted(() => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(),
    timeEnd: vi.fn(),
    withContext: vi.fn(),
    child: vi.fn(),
  };

  logger.withContext.mockReturnValue(logger);
  logger.child.mockReturnValue(logger);

  return logger;
});

vi.mock("../../../src/common/runtime/koduck-flow-runtime", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/common/runtime/koduck-flow-runtime")
  >("../../../src/common/runtime/koduck-flow-runtime");

  return {
    ...actual,
    createKoduckFlowRuntime: createKoduckFlowRuntimeMock,
  };
});

vi.mock("../../../src/common/logger", () => ({
  logger: loggerMock,
}));

import { createDiagnosticRuntime } from "../../../src/common/runtime/diagnostic-runtime";

describe("createDiagnosticRuntime", () => {
  beforeEach(() => {
    createKoduckFlowRuntimeMock.mockReset();
    loggerMock.info.mockReset();
    const runtime = { dispose: vi.fn() } as Record<string, unknown>;
    createKoduckFlowRuntimeMock.mockReturnValue(runtime);
  });

  it("delegates runtime creation to base factory", () => {
    const options = { label: "QA", overrides: { value: 1 } } as Record<string, unknown>;

    const runtime = createDiagnosticRuntime(options);

    expect(createKoduckFlowRuntimeMock).toHaveBeenCalledWith(options);
    expect(runtime).toBe(createKoduckFlowRuntimeMock.mock.results[0]!.value);
  });

  it("logs metadata when label is provided", () => {
    createDiagnosticRuntime({ label: "QA Diagnostics" } as Record<string, unknown>);

    expect(loggerMock.info).toHaveBeenCalledWith("Diagnostic runtime created", {
      event: "runtime-created",
      metadata: {
        label: "QA Diagnostics",
        factory: "DiagnosticRuntime",
      },
    });
  });

  it("omits logging when label is missing", () => {
    createDiagnosticRuntime({} as Record<string, unknown>);

    expect(loggerMock.info).not.toHaveBeenCalled();
  });
});
