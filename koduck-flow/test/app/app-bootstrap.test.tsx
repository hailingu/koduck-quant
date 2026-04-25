import { beforeEach, describe, expect, it, vi } from "vitest";

const createRootMock = vi.hoisted(() => vi.fn());
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
const getRuntimeForEnvironmentMock = vi.hoisted(() => vi.fn());

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

vi.mock("../../src/common/logger", () => ({
  logger: loggerMock,
}));

vi.mock("../../src/common/global-runtime", () => ({
  DEFAULT_DUCKFLOW_ENVIRONMENT: "test-default",
  getRuntimeForEnvironment: getRuntimeForEnvironmentMock,
}));

vi.mock("../../src/App.tsx", () => ({
  default: () => null,
}));

describe("main bootstrap", () => {
  let renderSpy: ReturnType<typeof vi.fn>;
  let registryManager: {
    constructor: { name: string };
    toString: () => string;
    getRegistryNames: ReturnType<typeof vi.fn>;
    hasRegistry: ReturnType<typeof vi.fn>;
    getRegistry: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetModules();

    renderSpy = vi.fn();
    createRootMock.mockReset();
    createRootMock.mockReturnValue({ render: renderSpy });

    loggerMock.debug.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.time.mockReset();
    loggerMock.timeEnd.mockReset();
    loggerMock.withContext.mockReset();
    loggerMock.withContext.mockReturnValue(loggerMock);
    loggerMock.child.mockReset();
    loggerMock.child.mockReturnValue(loggerMock);

    getRuntimeForEnvironmentMock.mockReset();

    registryManager = {
      constructor: { name: "MockRegistryManager" },
      toString: () => "[MockRegistryManager]",
      getRegistryNames: vi.fn(() => ["uml-class-canvas", "uml-interface-canvas"]),
      hasRegistry: vi.fn(() => true),
      getRegistry: vi.fn(() => ({})),
    };

    getRuntimeForEnvironmentMock.mockReturnValue({ RegistryManager: registryManager });

    document.body.innerHTML = "";
  });

  it("renders App inside StrictMode when root container exists", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    await import("../../src/main.tsx");

    expect(getRuntimeForEnvironmentMock).toHaveBeenCalledWith("test-default");
    expect(registryManager.getRegistryNames).toHaveBeenCalled();
    expect(registryManager.hasRegistry).toHaveBeenCalled();
    expect(createRootMock).toHaveBeenCalledWith(root);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).toHaveBeenCalledWith("🚀 应用启动 - 检查UML注册表状态");
    expect(loggerMock.error).not.toHaveBeenCalledWith(
      "Root container '#root' was not found. Skipping render bootstrap."
    );
  });

  it("logs an error when the root container is missing", async () => {
    await import("../../src/main.tsx");

    expect(createRootMock).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledWith(
      "Root container '#root' was not found. Skipping render bootstrap."
    );
  });
});
