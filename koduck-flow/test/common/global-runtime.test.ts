import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/common/logger", () => {
  const debug = vi.fn();
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  const time = vi.fn();
  const timeEnd = vi.fn();

  const createMockLoggerAdapter = () => ({
    debug,
    info,
    warn,
    error,
    time,
    timeEnd,
  });

  return {
    logger: {
      info,
      debug,
      warn,
      error,
      withContext: vi.fn(() => createMockLoggerAdapter()),
      child: vi.fn(() => createMockLoggerAdapter()),
    },
  };
});

import { logger } from "../../src/common/logger";
import { DuckFlowRuntime, createDuckFlowRuntime } from "../../src/common/runtime";
import { getGlobalRuntime } from "../../src/common/global-runtime";
import type { IManager } from "../../src/common/runtime";
import { RenderManager } from "../../src/common/render/render-manager";
import type { RuntimeManagerCoordinator } from "../../src/common/runtime/runtime-manager-coordinator";
import {
  ManagerInitializationError,
  type ManagerLifecycleState,
} from "../../src/common/runtime/types";

class TestManager implements IManager {
  readonly name: string;
  readonly type: string;
  initialize = vi.fn();
  dispose = vi.fn();

  constructor(name: string) {
    this.name = name;
    this.type = `${name}-manager`;
  }
}

function setupAnimationFrame(): () => void {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCaf = globalThis.cancelAnimationFrame;

  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => undefined) as typeof globalThis.cancelAnimationFrame;

  return () => {
    if (originalRaf) globalThis.requestAnimationFrame = originalRaf;
    else delete (globalThis as Record<string, unknown>).requestAnimationFrame;
    if (originalCaf) globalThis.cancelAnimationFrame = originalCaf;
    else delete (globalThis as Record<string, unknown>).cancelAnimationFrame;
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function getManagerCoordinator(runtime: DuckFlowRuntime): RuntimeManagerCoordinator {
  return (runtime as unknown as { _managerCoordinator: RuntimeManagerCoordinator })
    ._managerCoordinator;
}

function getManagerStates(runtime: DuckFlowRuntime): Map<string, ManagerLifecycleState> {
  const coordinator = getManagerCoordinator(runtime);
  return (coordinator as unknown as { managerStates: Map<string, ManagerLifecycleState> })
    .managerStates;
}

async function waitForManagerInitialization(runtime: DuckFlowRuntime, name: string): Promise<void> {
  const managerStates = getManagerStates(runtime);
  const pending = managerStates.get(name)?.promise;
  if (!pending) {
    return;
  }

  try {
    await pending;
  } catch {
    // allow tests to inspect failure state without surfacing unhandled rejections
  }
}

describe("DuckFlowRuntime", () => {
  let disposeAnimationFrame: () => void;
  let runtime: DuckFlowRuntime;

  beforeAll(() => {
    disposeAnimationFrame = setupAnimationFrame();
  });

  afterAll(() => {
    disposeAnimationFrame?.();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    runtime = createDuckFlowRuntime();
  });

  afterEach(() => {
    vi.useRealTimers();
    runtime.dispose();
  });

  it("exposes core managers", () => {
    expect(runtime.EntityManager).toBeDefined();
    expect(runtime.RenderManager).toBeDefined();
    expect(runtime.RegistryManager).toBeDefined();
    expect(runtime.EventBus).toBeDefined();
    expect(runtime.RenderEvents).toBeDefined();
    expect(runtime.EntityEvents).toBeDefined();
  });

  it("initializes core managers and wires dependencies", () => {
    const renderSpy = vi.spyOn(RenderManager.prototype, "connectToEntityManager");
    const registrySpy = vi.spyOn(RenderManager.prototype, "connectToRegistryManager");

    const scoped = createDuckFlowRuntime();

    expect(renderSpy).toHaveBeenCalled();
    expect(registrySpy).toHaveBeenCalled();

    scoped.dispose();
  });

  it("registers managers eagerly by default", async () => {
    const manager = new TestManager("test");

    runtime.registerManager("test", manager);

    await flushMicrotasks();

    expect(manager.initialize).toHaveBeenCalledTimes(1);
    expect(runtime.getManager("test")).toBe(manager);
    await vi.waitFor(() => {
      expect(runtime.getInitializedManagers()).toContain("test");
    });

    runtime.unregisterManager("test");
  });

  it("supports lazy managers that initialize on first access", async () => {
    const manager = new TestManager("lazy");

    runtime.registerManager("lazy", manager, { lazy: true });

    expect(manager.initialize).not.toHaveBeenCalled();
    const resolved = runtime.getManager("lazy");
    expect(resolved).toBe(manager);
    await flushMicrotasks();
    expect(manager.initialize).toHaveBeenCalledTimes(1);
  });

  it("resolves dependencies before initializing dependent manager", async () => {
    const dependency = new TestManager("dep");
    const dependent = new TestManager("dependent");

    runtime.registerManager("dependency", dependency, { lazy: true });
    runtime.registerManager("dependent", dependent, {
      lazy: true,
      dependencies: ["dependency"],
    });

    runtime.getManager("dependent");

    await vi.waitFor(() => {
      expect(dependency.initialize).toHaveBeenCalledTimes(1);
      expect(dependent.initialize).toHaveBeenCalledTimes(1);
    });

    const dependencyOrder = dependency.initialize.mock.invocationCallOrder[0] ?? Infinity;
    const dependentOrder = dependent.initialize.mock.invocationCallOrder[0] ?? -Infinity;
    expect(dependencyOrder).toBeLessThan(dependentOrder);
    expect(runtime.getInitializedManagers()).toEqual(
      expect.arrayContaining(["dependency", "dependent"])
    );
  });

  it("throws when registering manager with missing dependency", () => {
    const manager = new TestManager("missing");

    expect(() => {
      runtime.registerManager("broken", manager, {
        dependencies: ["does-not-exist"],
      });
    }).toThrow("Manager 'broken': missing dependency 'does-not-exist'");
  });

  it("records initialization failures and surfaces the original cause", async () => {
    const failingManager = new TestManager("failing");
    const rootError = new Error("boom");
    failingManager.initialize.mockRejectedValue(rootError);

    runtime.registerManager("failing", failingManager);

    await waitForManagerInitialization(runtime, "failing");

    expect(runtime.getInitializedManagers()).not.toContain("failing");

    let capturedError: unknown;
    try {
      runtime.getManager("failing");
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeDefined();
    const managerError = capturedError as Error & { cause?: unknown };
    expect(managerError.name).toBe("ManagerInitializationError");
    expect(managerError.message).toContain("failing");
    expect(managerError.message).toContain("initialization previously failed");
    expect(managerError.cause).toBe(rootError);
  });

  it("propagates dependency failures with error chaining", async () => {
    const dependencyError = new Error("dependency failed");
    const dependency = new TestManager("dependency");
    dependency.initialize.mockRejectedValue(dependencyError);
    const dependent = new TestManager("dependent");

    runtime.registerManager("dependency", dependency);
    await waitForManagerInitialization(runtime, "dependency");

    runtime.registerManager("dependent", dependent, {
      lazy: true,
      dependencies: ["dependency"],
    });

    runtime.getManager("dependent");

    await waitForManagerInitialization(runtime, "dependency");
    await waitForManagerInitialization(runtime, "dependent");

    let capturedError: unknown;
    try {
      runtime.getManager("dependent");
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeDefined();
    const managerError = capturedError as Error & { cause?: unknown };
    expect(managerError.name).toBe("ManagerInitializationError");
    expect(managerError.message).toContain("initialization previously failed");
    expect(managerError.cause).toBeInstanceOf(ManagerInitializationError);

    const dependencyFailure = managerError.cause as ManagerInitializationError & {
      cause?: unknown;
    };
    expect(dependencyFailure.message).toContain("dependency 'dependency' failed to initialize");

    const dependencyRootCause = dependencyFailure.cause as ManagerInitializationError | undefined;
    expect(dependencyRootCause).toBeInstanceOf(ManagerInitializationError);
    expect(dependencyRootCause?.message).toContain("initialization previously failed");

    const dependencyOriginalError = dependencyRootCause?.cause as Error | undefined;
    expect(dependencyOriginalError).toBeInstanceOf(Error);
    expect(dependencyOriginalError?.message).toBe("dependency failed");
  });

  it("retries manager initialization when configured", async () => {
    vi.useFakeTimers();

    const flaky = new TestManager("flaky");
    const firstFailure = new Error("first failure");
    flaky.initialize.mockRejectedValueOnce(firstFailure);
    flaky.initialize.mockResolvedValueOnce(undefined);

    runtime.registerManager("flaky", flaky, {
      lazy: true,
      initialization: {
        retries: {
          attempts: 2,
          delayMs: 25,
        },
      },
    });

    runtime.getManager("flaky");

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(25);
    await flushMicrotasks();

    expect(flaky.initialize).toHaveBeenCalledTimes(2);
    expect(runtime.getInitializedManagers()).toEqual(expect.arrayContaining(["flaky"]));
    expect(logger.warn).toHaveBeenCalledWith(
      "[duck-flow] Manager initialization attempt failed",
      expect.objectContaining({
        name: "flaky",
        attempt: 1,
        attempts: 2,
        delayMs: 25,
        error: firstFailure,
      })
    );
  });

  it("enforces initialization timeout and logs warnings by default", async () => {
    vi.useFakeTimers();

    const slow = new TestManager("slow");
    slow.initialize.mockImplementation(() => new Promise(() => undefined));

    runtime.registerManager("slow", slow, {
      lazy: true,
      initialization: {
        timeoutMs: 50,
      },
    });

    runtime.getManager("slow");

    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(50);
    await flushMicrotasks();

    expect(logger.warn).toHaveBeenCalledWith(
      "[duck-flow] Manager initialization attempt timed out",
      expect.objectContaining({
        name: "slow",
        attempt: 1,
        attempts: 1,
        timeoutMs: 50,
      })
    );

    await flushMicrotasks();

    expect(() => runtime.getManager("slow")).toThrow("initialization previously failed");
  });

  it("disposes non-core managers on unregister", () => {
    const manager = new TestManager("temp");

    runtime.registerManager("temp", manager);
    runtime.unregisterManager("temp");

    expect(runtime.hasManager("temp")).toBe(false);
    expect(manager.dispose).toHaveBeenCalledTimes(1);
  });

  it("prevents unregistering core managers", () => {
    runtime.unregisterManager("entity");
    runtime.unregisterManager("render");
    runtime.unregisterManager("registry");

    expect(logger.warn).toHaveBeenCalledWith("Cannot unregister core manager 'entity'");
    expect(logger.warn).toHaveBeenCalledWith("Cannot unregister core manager 'render'");
    expect(logger.warn).toHaveBeenCalledWith("Cannot unregister core manager 'registry'");
  });
});

describe("Global Runtime Management", () => {
  let disposeAnimationFrame: () => void;

  beforeAll(() => {
    disposeAnimationFrame = setupAnimationFrame();
  });

  afterAll(() => {
    disposeAnimationFrame?.();
  });

  it("exports a global runtime instance", () => {
    const runtime = getGlobalRuntime();
    expect(runtime).toBeInstanceOf(DuckFlowRuntime);
    expect(runtime.hasManager("entity")).toBe(true);
    expect(runtime.hasManager("render")).toBe(true);
    expect(runtime.getRegisteredManagers()).toEqual(
      expect.arrayContaining(["entity", "render", "registry"])
    );
  });

  it("keeps core managers initialized", () => {
    const runtime = getGlobalRuntime();
    const initialized = runtime.getInitializedManagers();
    expect(initialized).toEqual(expect.arrayContaining(["entity", "render", "registry"]));
  });

  it("provides convenience entity APIs", () => {
    const runtime = getGlobalRuntime();
    const spy = vi.spyOn(runtime.EntityManager, "getEntities").mockReturnValue([]);

    const entities = runtime.getEntities();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(entities).toEqual([]);
  });
});
