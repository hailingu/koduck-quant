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

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

vi.mock("../../src/common/logger", () => ({
  logger: loggerMock,
}));

vi.mock("../../src/App.tsx", () => ({
  default: () => null,
}));

describe("main bootstrap", () => {
  let renderSpy: ReturnType<typeof vi.fn>;

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

    document.body.innerHTML = "";
  });

  it("renders App inside StrictMode when root container exists", async () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    await import("../../src/main.tsx");

    expect(createRootMock).toHaveBeenCalledWith(root);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(loggerMock.info).not.toHaveBeenCalled();
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
