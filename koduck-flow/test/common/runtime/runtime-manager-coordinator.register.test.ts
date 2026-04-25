import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/common/logger", () => {
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

import { logger } from "../../../src/common/logger";
import { RuntimeManagerCoordinator } from "../../../src/common/runtime/runtime-manager-coordinator";
import type { IManager } from "../../../src/common/manager/types";
import {
  MANAGER_LIFECYCLE_STATUS,
  type ManagerLifecycleState,
  ManagerInitializationError,
} from "../../../src/common/runtime/types";

class TestManager implements IManager {
  readonly name: string;
  readonly type: string;
  initialize = vi.fn<() => void | Promise<void>>();
  dispose = vi.fn();

  constructor(name: string) {
    this.name = name;
    this.type = `${name}-manager`;
  }
}

const getManagerStates = (
  coordinator: RuntimeManagerCoordinator
): Map<string, ManagerLifecycleState> =>
  (coordinator as unknown as { managerStates: Map<string, ManagerLifecycleState> }).managerStates;

const getInitializedManagers = (coordinator: RuntimeManagerCoordinator): Set<string> =>
  (coordinator as unknown as { initializedManagers: Set<string> }).initializedManagers;

describe("RuntimeManagerCoordinator.registerManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("eager registration resolves initialization and logs structured success", async () => {
    const manager = new TestManager("analytics");
    manager.initialize.mockResolvedValue(undefined);
    const coordinator = new RuntimeManagerCoordinator();

    coordinator.registerManager("analytics", manager);

    const pendingState = getManagerStates(coordinator).get("analytics");
    await pendingState?.promise;

    const managerStates = getManagerStates(coordinator);
    expect(managerStates.get("analytics")?.status).toBe(MANAGER_LIFECYCLE_STATUS.Ready);
    expect(getInitializedManagers(coordinator).has("analytics")).toBe(true);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "[duck-flow] Manager initialized",
      expect.objectContaining({
        manager: "analytics",
        dependencies: [],
        path: ["analytics"],
        origin: "initializeManager",
      })
    );
  });

  it("eager registration surfaces initialization errors and preserves failure state", async () => {
    const manager = new TestManager("broken");
    const rootError = new ManagerInitializationError("broken", "boom");
    manager.initialize.mockRejectedValue(rootError);
    const coordinator = new RuntimeManagerCoordinator();

    coordinator.registerManager("broken", manager);

    const managerStates = getManagerStates(coordinator);
    const initializingState = managerStates.get("broken");
    expect(initializingState?.status).toBe(MANAGER_LIFECYCLE_STATUS.Initializing);
    expect(initializingState?.promise).toBeInstanceOf(Promise);

    await expect(initializingState?.promise).rejects.toBe(rootError);

    const failedState = managerStates.get("broken");
    expect(failedState?.status).toBe(MANAGER_LIFECYCLE_STATUS.Failed);
    expect(failedState?.error).toBe(rootError);
    expect(failedState?.path).toEqual(["broken"]);

    expect(logger.error).toHaveBeenCalledWith(
      "[duck-flow] Manager initialization failed",
      expect.objectContaining({
        manager: "broken",
        dependencies: [],
        path: ["broken"],
        origin: "initializeManager",
        error: rootError,
      })
    );
    expect(logger.error).toHaveBeenCalledWith(
      "[duck-flow] Manager eager initialization failed",
      expect.objectContaining({
        manager: "broken",
        dependencies: [],
        path: ["broken"],
        origin: "registerManager",
        error: rootError,
      })
    );
    expect(logger.info).not.toHaveBeenCalled();

    let thrown: unknown;
    expect(() => {
      try {
        coordinator.getManager("broken");
      } catch (error) {
        thrown = error;
        throw error;
      }
    }).toThrow(ManagerInitializationError);

    const managerError = thrown as ManagerInitializationError & { cause?: unknown };
    expect(managerError.cause).toBe(rootError);
    expect(managerError.path).toEqual(["broken"]);
  });

  it("reuses initialization promise for lazy managers and avoids duplicate work", async () => {
    const manager = new TestManager("lazy");
    manager.initialize.mockResolvedValue(undefined);
    const coordinator = new RuntimeManagerCoordinator();

    coordinator.registerManager("lazy", manager, { lazy: true });

    const firstInitialization = coordinator.initializeManager("lazy");
    const secondInitialization = coordinator.initializeManager("lazy");

    expect(secondInitialization).toBe(firstInitialization);

    const managerStates = getManagerStates(coordinator);
    expect(managerStates.get("lazy")?.status).toBe(MANAGER_LIFECYCLE_STATUS.Initializing);

    await firstInitialization;
    expect(manager.initialize).toHaveBeenCalledTimes(1);

    expect(managerStates.get("lazy")?.status).toBe(MANAGER_LIFECYCLE_STATUS.Ready);

    await coordinator.initializeManager("lazy");
    expect(manager.initialize).toHaveBeenCalledTimes(1);

    expect(logger.error).not.toHaveBeenCalled();
  });
});
