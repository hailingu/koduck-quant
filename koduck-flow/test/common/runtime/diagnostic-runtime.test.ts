import { beforeEach, describe, expect, it, vi } from "vitest";

const createDuckFlowRuntimeMock = vi.hoisted(() => vi.fn());
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

vi.mock("../../../src/common/runtime/duck-flow-runtime", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/common/runtime/duck-flow-runtime")
  >("../../../src/common/runtime/duck-flow-runtime");

  return {
    ...actual,
    createDuckFlowRuntime: createDuckFlowRuntimeMock,
  };
});

vi.mock("../../../src/common/logger", () => ({
  logger: loggerMock,
}));

import { createDiagnosticRuntime } from "../../../src/common/runtime/diagnostic-runtime";

describe("createDiagnosticRuntime", () => {
  beforeEach(() => {
    createDuckFlowRuntimeMock.mockReset();
    loggerMock.info.mockReset();
    const runtime = { dispose: vi.fn() } as Record<string, unknown>;
    createDuckFlowRuntimeMock.mockReturnValue(runtime);
  });

  it("delegates runtime creation to base factory", () => {
    const options = { label: "QA", overrides: { value: 1 } } as Record<string, unknown>;

    const runtime = createDiagnosticRuntime(options);

    expect(createDuckFlowRuntimeMock).toHaveBeenCalledWith(options);
    expect(runtime).toBe(createDuckFlowRuntimeMock.mock.results[0]!.value);
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
