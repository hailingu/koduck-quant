import { beforeEach, describe, expect, it, vi } from "vitest";

import { RenderOrchestrator } from "../../../src/common/render/render-manager/render-orchestrator";
import type {
  IEntityLifecycleTracker,
  IRenderCacheCoordinator,
} from "../../../src/common/render/render-manager/contracts";
import type { RegistryManager } from "../../../src/common/registry";
import type { IEntity } from "../../../src/common/entity/types";
import type { IRender } from "../../../src/common/render/types";
import type { RenderPerformanceStats } from "../../../src/common/render/types";

const diagnosticsMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
})) as {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

vi.mock("../../../src/common/render/render-diagnostics", () => ({
  diagnostics: diagnosticsMock,
}));

const renderSelectorInstances: Array<{
  setRenderManager: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("../../../src/common/render/render-selector", () => ({
  RenderSelector: vi.fn().mockImplementation(() => {
    const instance = {
      setRenderManager: vi.fn(),
      selectOptimalRenderer: vi.fn(),
    };
    renderSelectorInstances.push(instance);
    return instance;
  }),
}));

const strategyControllerRecords: Array<{
  instance: {
    refreshRenderStrategy: ReturnType<typeof vi.fn>;
    applyStrategyTo: ReturnType<typeof vi.fn>;
    selectRenderer: ReturnType<typeof vi.fn>;
    configureStrategySelector: ReturnType<typeof vi.fn>;
    buildStrategyContext: ReturnType<typeof vi.fn>;
    resolveCanvasRenderer: ReturnType<typeof vi.fn>;
    resolveReactRenderer: ReturnType<typeof vi.fn>;
    resolveSSRRenderer: ReturnType<typeof vi.fn>;
    resolveWebGPURenderer: ReturnType<typeof vi.fn>;
  };
  options: unknown;
}> = [];

vi.mock("../../../src/common/render/render-manager/render-strategy-controller", () => ({
  RenderStrategyController: vi.fn().mockImplementation((options) => {
    const instance = {
      refreshRenderStrategy: vi.fn(),
      applyStrategyTo: vi.fn(),
      selectRenderer: vi.fn(),
      configureStrategySelector: vi.fn(),
      buildStrategyContext: vi.fn(),
      resolveCanvasRenderer: vi.fn(),
      resolveReactRenderer: vi.fn(),
      resolveSSRRenderer: vi.fn(),
      resolveWebGPURenderer: vi.fn(),
    };
    strategyControllerRecords.push({ instance, options });
    return instance;
  }),
}));

const reactRendererInstances: Array<{ setRegistryManager: ReturnType<typeof vi.fn> }> = [];
vi.mock("../../../src/common/render/react-render", () => ({
  ReactRender: vi.fn().mockImplementation(() => {
    const instance = {
      setRegistryManager: vi.fn(),
      getName: vi.fn().mockReturnValue("react"),
      getType: vi.fn().mockReturnValue("react"),
    };
    reactRendererInstances.push(instance);
    return instance;
  }),
}));

const canvasRendererInstances: Array<{ setRegistryManager: ReturnType<typeof vi.fn> }> = [];
vi.mock("../../../src/common/render/canvas-render", () => ({
  CanvasRender: vi.fn().mockImplementation(() => {
    const instance = {
      setRegistryManager: vi.fn(),
      getName: vi.fn().mockReturnValue("canvas"),
      getType: vi.fn().mockReturnValue("canvas"),
    };
    canvasRendererInstances.push(instance);
    return instance;
  }),
}));

const createRenderStub = (name: string, type: ReturnType<IRender["getType"]>) => {
  const renderer: IRender = {
    getName: () => name,
    getType: () => type,
    render: vi.fn(),
    canRender: vi.fn().mockReturnValue(true),
    getPerformanceStats: () =>
      ({
        renderCount: 0,
        totalRenderTime: 0,
        averageRenderTime: 0,
        type,
        name,
      }) as RenderPerformanceStats,
    setRegistryManager: vi.fn(),
    dispose: vi.fn(),
  };

  return renderer;
};

const createCacheCoordinatorStub = () => {
  const stub: IRenderCacheCoordinator = {
    getVersion: vi.fn().mockReturnValue(0),
    bumpVersion: vi.fn(),
    setRenderContext: vi.fn(),
    getRenderContext: vi.fn(),
    updateRenderContext: vi.fn(),
    renderAll: vi.fn(),
    getCanvasArtifacts: vi.fn().mockReturnValue({}),
    getPerformanceStats: vi.fn().mockReturnValue({
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      type: "cache",
      name: "cache",
    } as RenderPerformanceStats),
    setCanvasResolver: vi.fn(),
    dispose: vi.fn(),
  };
  return stub;
};

const createOrchestrator = () => {
  const entityTracker = {} as unknown as IEntityLifecycleTracker;
  const cacheCoordinator = createCacheCoordinatorStub();

  const orchestrator = new RenderOrchestrator({
    entityTracker,
    cacheCoordinator,
  });

  const strategyRecord = strategyControllerRecords.at(-1)!;

  return {
    orchestrator,
    entityTracker,
    cacheCoordinator,
    strategy: strategyRecord.instance,
    strategyOptions: strategyRecord.options as {
      renderers: Map<string, unknown>;
    },
  };
};

describe("RenderOrchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    renderSelectorInstances.length = 0;
    strategyControllerRecords.length = 0;
    reactRendererInstances.length = 0;
    canvasRendererInstances.length = 0;
  });

  it("initializes core renderers and strategy controller", () => {
    const ctx = createOrchestrator();

    expect(ctx.cacheCoordinator.bumpVersion).toHaveBeenCalledTimes(2);
    expect(renderSelectorInstances[0].setRenderManager).toHaveBeenCalledWith({
      getVersion: expect.any(Function),
    });
    expect(ctx.strategy?.refreshRenderStrategy).toHaveBeenCalled();
    expect(Array.from(ctx.strategyOptions.renderers.keys())).toEqual(["react", "canvas"]);
  });

  it("registers and unregisters renderers while managing defaults", () => {
    const ctx = createOrchestrator();
    const { orchestrator, cacheCoordinator, strategy } = ctx;

    strategy.refreshRenderStrategy.mockClear();
    const customRenderer = createRenderStub("svg", "react");
    orchestrator.registerRenderer("svg", customRenderer);

    expect(cacheCoordinator.bumpVersion).toHaveBeenCalledTimes(3);
    expect(strategy.refreshRenderStrategy).toHaveBeenCalled();
    expect(orchestrator.getRegisteredRenderers()).toContain("svg");

    orchestrator.setDefaultRenderer("svg");
    const removed = orchestrator.unregisterRenderer("svg");

    expect(removed).toBe(true);
    expect(orchestrator.getDefaultRenderer()).toBe("react");
    expect(cacheCoordinator.bumpVersion).toHaveBeenCalledTimes(4);
  });

  it("attaches new trackers and cache coordinators", () => {
    const ctx = createOrchestrator();
    const newTracker = {} as unknown as IEntityLifecycleTracker;
    ctx.strategy.applyStrategyTo.mockClear();
    ctx.orchestrator.attachEntityTracker(newTracker);
    expect(ctx.strategy.applyStrategyTo).toHaveBeenCalledWith(newTracker);

    const newCache = createCacheCoordinatorStub();
    ctx.orchestrator.attachCacheCoordinator(newCache);
    expect(newCache.setCanvasResolver).toHaveBeenCalledWith(expect.any(Function));
  });

  it("delegates selection and strategy operations", () => {
    const ctx = createOrchestrator();
    const pickedRenderer = createRenderStub("picked", "react");
    ctx.strategy.selectRenderer.mockReturnValue(pickedRenderer);
    ctx.strategy.buildStrategyContext.mockReturnValue({
      nodes: [],
      viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
      timestamp: 0,
    });

    const result = ctx.orchestrator.selectRenderer({} as IEntity);
    expect(result).toBe(pickedRenderer);

    ctx.orchestrator.configureStrategySelector();
    expect(ctx.strategy.configureStrategySelector).toHaveBeenCalled();

    ctx.orchestrator.refreshRenderStrategy();
    expect(ctx.strategy.refreshRenderStrategy).toHaveBeenCalled();
  });

  it("resolves renderers via strategy controller", () => {
    const ctx = createOrchestrator();
    const canvasStub = {} as unknown;
    const reactStub = {} as unknown;
    const ssrStub = {} as unknown;
    const gpuStub = createRenderStub("gpu", "webgpu");
    ctx.strategy.resolveCanvasRenderer.mockReturnValue(canvasStub as never);
    ctx.strategy.resolveReactRenderer.mockReturnValue(reactStub as never);
    ctx.strategy.resolveSSRRenderer.mockReturnValue(ssrStub as never);
    ctx.strategy.resolveWebGPURenderer.mockReturnValue(gpuStub as never);

    expect(ctx.orchestrator.resolveCanvasRenderer()).toBe(canvasStub);
    expect(ctx.orchestrator.resolveReactRenderer()).toBe(reactStub);
    expect(ctx.orchestrator.resolveSSRRenderer()).toBe(ssrStub);
    expect(ctx.orchestrator.resolveWebGPURenderer()).toBe(gpuStub);
  });

  it("registers registry manager across renderers", () => {
    const ctx = createOrchestrator();
    const registry = {} as unknown as RegistryManager;

    ctx.orchestrator.registerRegistryManager(registry);

    expect(canvasRendererInstances[0].setRegistryManager).toHaveBeenCalledWith(registry);
    expect(reactRendererInstances[0].setRegistryManager).toHaveBeenCalledWith(registry);
    expect(ctx.strategy.refreshRenderStrategy).toHaveBeenCalled();
  });

  it("setDefaultRenderer returns false for unknown renderer", () => {
    const ctx = createOrchestrator();
    expect(ctx.orchestrator.setDefaultRenderer("missing")).toBe(false);
    expect(ctx.orchestrator.getDefaultRenderer()).toBe("react");
  });
});
