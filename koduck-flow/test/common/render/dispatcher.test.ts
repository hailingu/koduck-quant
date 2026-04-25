import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  RenderDispatcher,
  RenderManager,
  createRenderDispatcher,
  createRenderManager,
} from "../../../src/common/render/render-manager/dispatcher";
import type { RenderManagerDependencies } from "../../../src/common/render/render-manager/types";

const coreConstructor = vi.fn();

vi.mock("../../../src/common/render/render-manager/dispatcher-core", () => {
  class RenderDispatcherCoreMock {
    public deps: unknown;

    constructor(deps: unknown) {
      this.deps = deps;
      coreConstructor(deps);
    }
  }

  return {
    RenderDispatcherCore: RenderDispatcherCoreMock,
  };
});

const createDependencies = (): RenderManagerDependencies =>
  ({
    renderEvents: {
      onRenderAll: vi.fn(() => vi.fn()),
      onRenderEntities: vi.fn(() => vi.fn()),
      onViewportChanged: vi.fn(() => vi.fn()),
      requestRenderAll: vi.fn(),
      requestRenderEntities: vi.fn(),
    },
  }) as unknown as RenderManagerDependencies;

describe("dispatcher facade", () => {
  beforeEach(() => {
    coreConstructor.mockClear();
  });

  it("constructs RenderDispatcher by delegating to RenderDispatcherCore", async () => {
    const deps = createDependencies();
    const dispatcher = new RenderDispatcher(deps);

    expect(dispatcher).toBeInstanceOf(RenderDispatcher);
    expect(coreConstructor).toHaveBeenCalledWith(deps);
  });

  it("provides factory helpers for dispatcher and manager", () => {
    const deps = createDependencies();

    const dispatcher = createRenderDispatcher(deps);
    expect(dispatcher).toBeInstanceOf(RenderDispatcher);

    const manager = new RenderManager(deps);
    expect(manager).toBeInstanceOf(RenderDispatcher);

    const createdManager = createRenderManager(deps);
    expect(createdManager).toBeInstanceOf(RenderManager);
    expect(coreConstructor).toHaveBeenCalledTimes(3);
  });
});
