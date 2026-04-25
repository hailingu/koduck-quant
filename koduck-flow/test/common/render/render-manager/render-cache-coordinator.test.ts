import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ICanvasRenderer, IRenderContext } from "../../../../src/common/render/types";
import type { RenderMetricsModule } from "../../../../src/common/render/render-manager/render-metrics-module";
import type { IEntityLifecycleTracker } from "../../../../src/common/render/render-manager/contracts";
import { RenderCacheCoordinator } from "../../../../src/common/render/render-manager/render-cache-coordinator";

type RendererStub = ICanvasRenderer & {
  __context: IRenderContext;
  __setCalls: Array<IRenderContext>;
  __updateCalls: Array<Partial<IRenderContext>>;
};

type MetricsStub = RenderMetricsModule & {
  __recorded: string[];
  __stats: { renderCount: number; averageRenderTime: number; totalRenderTime: number } & Record<
    string,
    unknown
  >;
};

function createRenderer(): RendererStub {
  const baseContext: IRenderContext = {
    nodes: [],
    viewport: { x: 0, y: 0, zoom: 1, width: 100, height: 100 },
    timestamp: 0,
    metadata: { source: "stub" },
    canvas: {
      id: "canvas",
      getContext: vi.fn(() => ({ kind: "2d" }) as unknown),
    } as unknown as HTMLCanvasElement,
  };

  const stub: Partial<ICanvasRenderer> & {
    __context: IRenderContext;
    __setCalls: Array<IRenderContext>;
    __updateCalls: Array<Partial<IRenderContext>>;
  } = {
    __context: baseContext,
    __setCalls: [],
    __updateCalls: [],
    getName: () => "renderer-stub",
    getType: () => "canvas",
    setRegistryManager: vi.fn(),
    dispose: vi.fn(),
    render: vi.fn(),
    canRender: vi.fn(() => true),
    getPriority: () => 1,
    canHandle: () => true,
    setRenderContext(context: IRenderContext) {
      this.__setCalls.push(context);
      this.__context = context;
    },
    updateRenderContext(updates: Partial<IRenderContext>) {
      this.__updateCalls.push(updates);
      Object.assign(this.__context, updates);
    },
    getRenderContext() {
      return this.__context;
    },
  };

  return stub as RendererStub;
}

function createMetrics(): MetricsStub {
  const stats = {
    renderCount: 5,
    averageRenderTime: 2,
    totalRenderTime: 10,
    type: "canvas",
    name: "renderer-stub",
    cacheHitCount: 1,
    cacheMissCount: 2,
    renderers: ["renderer-stub"],
    totalRenderers: 1,
    defaultRenderer: "renderer-stub",
  };

  const recorded: string[] = [];

  return {
    __recorded: recorded,
    __stats: stats,
    recordContextOperation: vi.fn((op: "set" | "update") => recorded.push(op)),
    getPerformanceStats: vi.fn(() => stats),
    recordLifecycle: vi.fn(),
    recordConnection: vi.fn(),
    recordRedrawScheduled: vi.fn(),
    recordFullRedrawRequest: vi.fn(),
    recordEventBridge: vi.fn(),
    recordError: vi.fn(),
    recordDirtyFallback: vi.fn(),
    recordSchedulerBackpressure: vi.fn(),
    getRenderStats: vi.fn(),
    dispose: vi.fn(),
    meter: {
      counter: vi.fn(() => ({ add: vi.fn() })),
      histogram: vi.fn(() => ({ record: vi.fn() })),
      attributes: { component: "RenderManager" },
    },
  } as unknown as MetricsStub;
}

describe("RenderCacheCoordinator", () => {
  let renderer: RendererStub;
  let fallbackRenderer: RendererStub;
  let metrics: MetricsStub;
  let resolve: ReturnType<typeof vi.fn<(rendererId?: string) => RendererStub>>;

  beforeEach(() => {
    renderer = createRenderer();
    fallbackRenderer = createRenderer();
    metrics = createMetrics();
    resolve = vi.fn<(rendererId?: string) => RendererStub>(() => renderer);
  });

  it("sets and updates render context while recording metrics", () => {
    const coordinator = new RenderCacheCoordinator({
      metrics,
      resolveCanvasRenderer: resolve,
      defaultRendererId: "primary",
    });

    expect(coordinator.getVersion()).toBe(0);

    const context: IRenderContext = {
      nodes: [{ id: "entity", type: "node", data: undefined, config: undefined, dispose: vi.fn() }],
      viewport: { x: 1, y: 2, zoom: 0.5, width: 400, height: 300 },
      timestamp: 42,
      metadata: { layer: "foreground" },
    };

    coordinator.setRenderContext(context);

    expect(resolve).toHaveBeenCalledWith("primary");
    expect(renderer.__setCalls).toContain(context);
    expect(metrics.__recorded).toContain("set");
    expect(coordinator.getVersion()).toBe(1);

    coordinator.updateRenderContext({
      timestamp: 100,
      viewport: { x: 5, y: 6, zoom: 1, width: 400, height: 300 },
    });

    expect(renderer.__updateCalls).toContainEqual({ timestamp: 100, viewport: expect.any(Object) });
    expect(metrics.__recorded).toContain("update");
    expect(coordinator.getVersion()).toBe(2);

    const bumped = coordinator.bumpVersion();
    expect(bumped).toBe(3);
    expect(coordinator.getVersion()).toBe(3);
  });

  it("renders tracked entities using cached artifacts", () => {
    const coordinator = new RenderCacheCoordinator({
      metrics,
      resolveCanvasRenderer: resolve,
    });

    const tracker: IEntityLifecycleTracker = {
      renderAll: vi.fn((callback: () => unknown) => callback()),
    } as unknown as IEntityLifecycleTracker;

    const artifactsSpy = vi.spyOn(
      coordinator as unknown as { getCanvasArtifacts: () => unknown },
      "getCanvasArtifacts"
    );

    coordinator.renderAll(tracker);

    expect(tracker.renderAll).toHaveBeenCalledTimes(1);
    expect(artifactsSpy).toHaveBeenCalledTimes(1);
  });

  it("provides canvas artifacts including 2d context", () => {
    const coordinator = new RenderCacheCoordinator({
      metrics,
      resolveCanvasRenderer: resolve,
    });

    const artifacts = coordinator.getCanvasArtifacts();

    expect(resolve).toHaveBeenCalledWith("canvas");
    expect(artifacts.renderer).toBe(renderer);
    expect(artifacts.context).toBe(renderer.__context);
    expect(artifacts.canvas).toBe(renderer.__context.canvas);
    expect(artifacts.c2d).toEqual({ kind: "2d" });
  });

  it("updates resolver and forwards performance stats", () => {
    resolve.mockImplementationOnce(() => renderer).mockImplementation(() => fallbackRenderer);

    const coordinator = new RenderCacheCoordinator({
      metrics,
      resolveCanvasRenderer: resolve,
      defaultRendererId: "primary",
    });

    const nextResolver = vi.fn(() => fallbackRenderer);
    coordinator.setCanvasResolver(nextResolver);

    coordinator.setRenderContext(renderer.__context);

    expect(nextResolver).toHaveBeenCalledWith("primary");
    expect(fallbackRenderer.__setCalls).toHaveLength(1);

    const stats = coordinator.getPerformanceStats();
    expect(stats).toBe(metrics.__stats);
  });
});
