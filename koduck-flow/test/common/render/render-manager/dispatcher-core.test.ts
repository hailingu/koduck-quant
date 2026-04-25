import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { RenderEventManager } from "../../../../src/common/event/render-event-manager";
import type { EntityManager } from "../../../../src/common/entity";
import type { RegistryManager } from "../../../../src/common/registry";
import type { FrameBackpressureEvent } from "../../../../src/common/render/render-manager/render-frame-scheduler";
import type { RenderManagerDependencies } from "../../../../src/common/render/render-manager/types";

const createRenderEventsStub = () => {
  const listeners = {
    renderAll: [] as Array<(payload: unknown) => void>,
    renderEntities: [] as Array<(payload: unknown) => void>,
    viewportChanged: [] as Array<(payload: unknown) => void>,
  };

  const stub: RenderEventManager = {
    onRenderAll: vi.fn((cb) => {
      listeners.renderAll.push(cb);
      return () => {
        const idx = listeners.renderAll.indexOf(cb);
        if (idx >= 0) listeners.renderAll.splice(idx, 1);
      };
    }),
    onRenderEntities: vi.fn((cb) => {
      listeners.renderEntities.push(cb);
      return () => {
        const idx = listeners.renderEntities.indexOf(cb);
        if (idx >= 0) listeners.renderEntities.splice(idx, 1);
      };
    }),
    onViewportChanged: vi.fn((cb) => {
      listeners.viewportChanged.push(cb);
      return () => {
        const idx = listeners.viewportChanged.indexOf(cb);
        if (idx >= 0) listeners.viewportChanged.splice(idx, 1);
      };
    }),
    requestRenderAll: vi.fn((payload) => listeners.renderAll.forEach((cb) => cb(payload))),
    requestRenderEntities: vi.fn((payload) =>
      listeners.renderEntities.forEach((cb) => cb(payload))
    ),
    notifyViewportChanged: vi.fn((payload) =>
      listeners.viewportChanged.forEach((cb) => cb(payload))
    ),
    setDebugMode: vi.fn(() => stub),
  } as unknown as RenderEventManager;

  return { stub, listeners };
};

const orchestratorSpies = vi.hoisted(() => {
  const renderers = new Map<string, unknown>();
  return {
    registerRenderer: vi.fn((name: string, renderer: unknown) => {
      renderers.set(name, renderer);
    }),
    unregisterRenderer: vi.fn((name: string) => renderers.delete(name)),
    getRenderer: vi.fn((name: string) => renderers.get(name)),
    getRegisteredRenderers: vi.fn(() => Array.from(renderers.keys())),
    selectRenderer: vi.fn(() => ({ renderer: null })),
    getDefaultRenderer: vi.fn(() => "canvas"),
    setDefaultRenderer: vi.fn(() => true),
    attachEntityTracker: vi.fn(),
    attachCacheCoordinator: vi.fn(),
    registerRegistryManager: vi.fn(),
    configureStrategySelector: vi.fn(),
    resolveCanvasRenderer: vi.fn(),
  };
});

const cacheCoordinatorSpies = vi.hoisted(() => ({
  getCanvasArtifacts: vi.fn(() => ({ renderer: undefined, context: undefined })),
  getVersion: vi.fn(() => 1),
  bumpVersion: vi.fn(() => 2),
  getRenderContext: vi.fn(),
  setRenderContext: vi.fn(),
  updateRenderContext: vi.fn(),
  renderAll: vi.fn(),
  getPerformanceStats: vi.fn(() => ({
    renderCount: 1,
    totalRenderTime: 10,
    averageRenderTime: 5,
    type: "stub",
    name: "stub",
  })),
  setCanvasResolver: vi.fn(),
  dispose: vi.fn(),
}));

const entityTrackerSpies = vi.hoisted(() => ({
  getEntities: vi.fn(() => []),
  getEntityMap: vi.fn(() => new Map()),
  getSize: vi.fn(() => 0),
  bootstrap: vi.fn(() => 0),
  scheduleDirtyFlush: vi.fn(),
  markEntityDirtyById: vi.fn(),
  markEntityDirty: vi.fn(),
  removeEntity: vi.fn(),
  getEntity: vi.fn(),
  addEntity: vi.fn(),
  setExternalEntityResolver: vi.fn(),
  render: vi.fn(),
  renderAll: vi.fn((cb: () => void) => cb()),
  getRenderResultsSize: vi.fn(() => 0),
  setRenderStrategy: vi.fn(),
  setStrategyContextBuilder: vi.fn(),
  dispose: vi.fn(),
  getEntitiesForView: vi.fn(() => []),
}));

const eventBridgeSpies = vi.hoisted(() => ({
  attach: vi.fn(),
  detach: vi.fn(),
}));

const dirtyModuleSpies = vi.hoisted(() => ({
  getManager: vi.fn(() => ({
    getDirtyRegionCount: vi.fn(() => 0),
    getDirtyEntityCount: vi.fn(() => 0),
    resetForFullRedraw: vi.fn(),
  })),
  requestFullRedraw: vi.fn(),
  scheduleRedraw: vi.fn(),
  scheduleDirtyFlush: vi.fn(),
  attachEntityTracker: vi.fn(),
  attachCanvasArtifactsProvider: vi.fn(),
  setRenderExecutor: vi.fn(),
  isFullRedrawPending: vi.fn(() => false),
  getDirtyRegions: vi.fn(() => []),
  getDirtyEntityIds: vi.fn(() => []),
}));

const visibilityModuleSpies = vi.hoisted(() => ({
  dispose: vi.fn(),
}));

const metricsModuleSpies = vi.hoisted(() => ({
  meter: { counter: vi.fn(() => ({ add: vi.fn() })) },
  recordLifecycle: vi.fn(),
  recordConnection: vi.fn(),
  recordContextOperation: vi.fn(),
  recordSchedulerBackpressure: vi.fn(),
  getRenderStats: vi.fn(() => ({
    queueSize: 0,
    dirtyRegionCount: 0,
    dirtyEntityCount: 0,
    pendingFullRedraw: false,
    metricsSummary: {
      lifecycle: {},
      connections: {},
      context: {},
      redrawScheduled: {},
      redrawRequested: {},
      redrawReasons: {},
      eventBridge: {},
      errors: {},
      dirtyFallbacks: {},
      schedulerBackpressure: {},
    },
  })),
  getPerformanceStats: vi.fn(() => ({
    renderCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    type: "stub",
    name: "stub",
  })),
  recordError: vi.fn(),
  dispose: vi.fn(),
}));

const schedulerSpies = vi.hoisted(() => ({
  setBackpressureListener: vi.fn(),
  scheduleRedraw: vi.fn(),
  setBudget: vi.fn(),
  dispose: vi.fn(),
}));

const diagnosticsSpies = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../../../../src/common/render/render-manager/render-orchestrator", () => ({
  RenderOrchestrator: vi.fn(() => orchestratorSpies),
}));

vi.mock("../../../../src/common/render/render-manager/render-cache-coordinator", () => ({
  RenderCacheCoordinator: vi.fn(() => cacheCoordinatorSpies),
}));

vi.mock("../../../../src/common/render/render-manager/entity-lifecycle-tracker", () => ({
  EntityLifecycleTracker: vi.fn(() => entityTrackerSpies),
}));

vi.mock("../../../../src/common/render/render-manager/dirty-region-coordinator", () => ({
  DirtyRegionCoordinator: vi.fn(() => dirtyModuleSpies),
}));

vi.mock("../../../../src/common/render/render-manager/render-metrics-module", () => ({
  RenderMetricsModule: vi.fn(() => metricsModuleSpies),
}));

vi.mock("../../../../src/common/render/render-manager/visibility", () => ({
  VisibilityModule: vi.fn(() => visibilityModuleSpies),
}));

vi.mock("../../../../src/common/render/render-manager/event-bridge-module", () => ({
  EventBridgeModule: vi.fn(() => eventBridgeSpies),
}));

vi.mock("../../../../src/common/render/render-manager/render-frame-scheduler", () => ({
  RenderFrameScheduler: vi.fn(() => schedulerSpies),
  RenderFrameSchedulerEvent: {
    BackpressureTriggered: "triggered",
    BackpressureRelieved: "relieved",
  },
}));

vi.mock("../../../../src/common/render/render-diagnostics", () => ({
  diagnostics: diagnosticsSpies,
}));

const { RenderDispatcherCore } = await import(
  "../../../../src/common/render/render-manager/dispatcher-core"
);
const dispatcherModule = await import("../../../../src/common/render/render-manager/dispatcher");
const coreModule = await import("../../../../src/common/render/render-manager/core");

const createDeps = (): RenderManagerDependencies => {
  const { stub } = createRenderEventsStub();
  const entityManager = {
    getEntity: vi.fn(),
    getEntities: vi.fn(() => []),
  } as unknown as EntityManager;

  const registryManager = {
    getRegistryNames: vi.fn(() => []),
  } as unknown as RegistryManager;

  return {
    renderEvents: stub,
    entityManager,
    registryManager,
  };
};

describe("RenderDispatcherCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wires registry and entity managers, and attaches orchestrator", () => {
    const deps = createDeps();
    const dispatcher = new RenderDispatcherCore(deps);

    expect(metricsModuleSpies.recordLifecycle).toHaveBeenCalledWith("init", expect.any(Object));
    expect(diagnosticsSpies.info).toHaveBeenCalledWith(
      "RenderManager initialized",
      expect.any(Object)
    );
    expect(orchestratorSpies.attachEntityTracker).toHaveBeenCalledTimes(1);
    expect(orchestratorSpies.attachCacheCoordinator).toHaveBeenCalledTimes(1);

    dispatcher.connectToRegistryManager(deps.registryManager!);
    expect(orchestratorSpies.registerRegistryManager).toHaveBeenCalledWith(deps.registryManager);
    expect(metricsModuleSpies.recordConnection).toHaveBeenCalledWith(
      "registry",
      expect.any(Object)
    );

    dispatcher.connectToEntityManager(deps.entityManager!);
    expect(entityTrackerSpies.bootstrap).toHaveBeenCalled();
    expect(metricsModuleSpies.recordConnection).toHaveBeenCalledWith("entity", expect.any(Object));
    expect(diagnosticsSpies.info).toHaveBeenCalledWith(
      "EntityManager connected",
      expect.any(Object)
    );
  });

  it("schedules redraw on context updates and proxies cache coordinator", () => {
    const deps = createDeps();
    const dispatcher = new RenderDispatcherCore(deps);

    dispatcher.setRenderContext({
      nodes: [],
      viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
      timestamp: 0,
    });
    expect(metricsModuleSpies.recordContextOperation).toHaveBeenCalledWith("set");
    expect(dirtyModuleSpies.scheduleRedraw).toHaveBeenCalledWith("context_set");

    dispatcher.updateRenderContext({ zoom: 2 });
    expect(metricsModuleSpies.recordContextOperation).toHaveBeenCalledWith("update");

    dispatcher.renderAll();
    expect(cacheCoordinatorSpies.renderAll).toHaveBeenCalled();

    dispatcher.dispose();
    expect(eventBridgeSpies.detach).toHaveBeenCalled();
    expect(metricsModuleSpies.recordLifecycle).toHaveBeenCalledWith("dispose", expect.any(Object));
    expect(metricsModuleSpies.dispose).toHaveBeenCalled();
  });

  it("records backpressure via registered listener", () => {
    const deps = createDeps();
    const dispatcher = new RenderDispatcherCore(deps);

    const listener = schedulerSpies.setBackpressureListener.mock.calls[0]?.[0];
    expect(listener).toBeTypeOf("function");

    const event: FrameBackpressureEvent = {
      reason: "triggered",
      active: true,
      metadata: { queueSize: 10, deferred: 2, budgetMs: 8 },
    } as FrameBackpressureEvent;

    listener?.(event);

    expect(metricsModuleSpies.recordSchedulerBackpressure).toHaveBeenCalledWith(
      "triggered",
      expect.objectContaining({ queue_size: 10, deferred: 2, budget_ms: 8 })
    );

    dispatcher.dispose();
  });

  it("creates dispatcher facade instances through helpers", () => {
    const deps = createDeps();
    const dispatcher = dispatcherModule.createRenderDispatcher(deps);

    expect(dispatcher).toBeInstanceOf(dispatcherModule.RenderDispatcher);
    expect(dispatcher).toBeInstanceOf(RenderDispatcherCore);

    const manager = dispatcherModule.createRenderManager(deps);
    expect(manager).toBeInstanceOf(dispatcherModule.RenderManager);
    expect(manager).toBeInstanceOf(RenderDispatcherCore);

    dispatcher.dispose();
    manager.dispose();
  });

  it("re-exports dispatcher facade from core entry point", () => {
    expect(coreModule.RenderDispatcher).toBe(dispatcherModule.RenderDispatcher);
    expect(coreModule.createRenderManager).toBe(dispatcherModule.createRenderManager);
    expect(coreModule.createRenderDispatcher).toBe(dispatcherModule.createRenderDispatcher);
  });
});
