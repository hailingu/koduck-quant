import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import type { IEntity } from "../../../src/common/entity/types";
import type {
  DirtyRegion,
  RenderMetricSummary,
} from "../../../src/common/render/render-manager/types";
import type { MeterSnapshot } from "../../../src/common/metrics";

vi.mock("../../../src/components/hooks/useDuckFlowRuntime", () => ({
  useDuckFlowManagers: vi.fn(),
}));

const { default: DebugPanel } = await import("../../../src/components/DebugPanel/DebugPanel");
const { useDuckFlowManagers } = await import("../../../src/components/hooks/useDuckFlowRuntime");
const useDuckFlowManagersMock = vi.mocked(useDuckFlowManagers);

type Listener<T> = (payload: T) => void;

type RenderEventListeners = {
  renderAll: Listener<unknown>[];
  renderEntities: Listener<unknown>[];
  viewport: Listener<unknown>[];
};

type EntityEventListeners = {
  added: Listener<IEntity>[];
  removed: Listener<IEntity>[];
  updated: Listener<IEntity>[];
  detailed: Listener<unknown>[];
};

type DuckFlowManagersValue = ReturnType<typeof useDuckFlowManagers>;

type ManagersStub = DuckFlowManagersValue & {
  __renderListeners: RenderEventListeners;
  __entityListeners: EntityEventListeners;
};

type ManagerOptions = {
  entities: IEntity[];
  renderQueue: IEntity[];
  dirtyRegions: DirtyRegion[];
  dirtyIds: string[];
  metricsSummary: RenderMetricSummary;
  metrics?: MeterSnapshot;
  pendingFullRedraw?: boolean;
};

function createEntity(id: string, type: string): IEntity {
  return {
    id,
    type,
    data: undefined,
    config: undefined,
    dispose: vi.fn(),
  } as IEntity;
}

function createManagers(options: Partial<ManagerOptions> = {}): ManagersStub {
  const entities = options.entities ?? [
    createEntity("node-1", "node"),
    createEntity("view-1", "view"),
  ];
  const renderQueue = options.renderQueue ?? entities;
  const dirtyRegions =
    options.dirtyRegions ?? ([{ x: 0, y: 0, width: 10, height: 10 }] as DirtyRegion[]);
  const dirtyIds = options.dirtyIds ?? entities.map((entity) => entity.id);

  const metricsSummary: RenderMetricSummary =
    options.metricsSummary ??
    ({
      lifecycle: { init: 2, idle: 0 },
      connections: { entity: 1 },
      context: { set: 3 },
      redrawScheduled: { full: 1 },
      redrawRequested: { manual: 2 },
      redrawReasons: { cacheMiss: 4, skipped: 0 },
      eventBridge: {},
      errors: {},
      dirtyFallbacks: {},
      schedulerBackpressure: { triggered: 1 },
    } as RenderMetricSummary);

  const metrics: MeterSnapshot | undefined =
    options.metrics ??
    ({
      scope: "render",
      counters: [],
      upDownCounters: [],
      gauges: [],
      histograms: [
        {
          name: "render.duration.ms",
          description: undefined,
          unit: undefined,
          points: {
            "renderer=canvas|entityType=node": {
              count: 2,
              sum: 12,
              buckets: [1, 2, 2],
              boundaries: [4, 8],
            },
            "renderer=react|entityType=widget": {
              count: 1,
              sum: 6,
              buckets: [0, 1, 1],
              boundaries: [4, 8],
            },
          },
        },
      ],
    } as MeterSnapshot);

  const renderStats = {
    queueSize: renderQueue.length,
    dirtyRegionCount: dirtyRegions.length,
    dirtyEntityCount: dirtyIds.length,
    pendingFullRedraw: options.pendingFullRedraw ?? false,
    metricsSummary,
    metrics,
  };

  const entityManager = {
    getEntities: vi.fn(() => entities),
  };

  const renderManager = {
    getTrackedEntities: vi.fn(() => renderQueue),
    getRenderStats: vi.fn(() => renderStats),
    getDirtyRegions: vi.fn(() => dirtyRegions),
    getDirtyEntityIds: vi.fn(() => dirtyIds),
  };

  const renderListeners: RenderEventListeners = {
    renderAll: [],
    renderEntities: [],
    viewport: [],
  };

  const renderEvents = {
    onRenderAll: vi.fn((handler: Listener<unknown>) => {
      renderListeners.renderAll.push(handler);
      return () => {
        const index = renderListeners.renderAll.indexOf(handler);
        if (index >= 0) renderListeners.renderAll.splice(index, 1);
      };
    }),
    onRenderEntities: vi.fn((handler: Listener<unknown>) => {
      renderListeners.renderEntities.push(handler);
      return () => {
        const index = renderListeners.renderEntities.indexOf(handler);
        if (index >= 0) renderListeners.renderEntities.splice(index, 1);
      };
    }),
    onViewportChanged: vi.fn((handler: Listener<unknown>) => {
      renderListeners.viewport.push(handler);
      return () => {
        const index = renderListeners.viewport.indexOf(handler);
        if (index >= 0) renderListeners.viewport.splice(index, 1);
      };
    }),
  };

  const entityListeners: EntityEventListeners = {
    added: [],
    removed: [],
    updated: [],
    detailed: [],
  };

  const makeEntityEmitter = <T,>(bucket: Listener<T>[]) => ({
    addEventListener: vi.fn((handler: Listener<T>) => {
      bucket.push(handler);
      return () => {
        const index = bucket.indexOf(handler);
        if (index >= 0) bucket.splice(index, 1);
      };
    }),
  });

  const entityEvents = {
    added: makeEntityEmitter<IEntity>(entityListeners.added),
    removed: makeEntityEmitter<IEntity>(entityListeners.removed),
    updated: makeEntityEmitter<IEntity>(entityListeners.updated),
    updatedWithDetail: makeEntityEmitter<unknown>(entityListeners.detailed),
  };

  class RuntimeStub {
    _managers = new Map<string, { type: string }>([
      ["entity", { type: "EntityManager" }],
      ["render", { type: "RenderManager" }],
      ["debug", { type: "DebugManager" }],
    ]);
    _managerStates = new Map<string, { status: string; path?: string[] }>([
      ["entity", { status: "ready", path: ["bootstrap"] }],
      ["render", { status: "initializing" }],
      ["debug", { status: "registered", path: [] }],
    ]);
    _dependencies = new Map<string, string[]>([["render", ["entity"]]]);

    getInitializedManagers(): string[] {
      return ["entity", "render"];
    }

    getRegisteredManagers(): string[] {
      return ["entity", "render", "debug", "registry"];
    }
  }

  const runtime = new RuntimeStub();

  return {
    runtime: runtime as unknown as DuckFlowManagersValue["runtime"],
    environment: undefined,
    factory: undefined,
    source: "local",
    entityManager: entityManager as unknown as ManagersStub["entityManager"],
    renderManager: renderManager as unknown as ManagersStub["renderManager"],
    registryManager: {
      getRegistryNames: vi.fn(() => []),
    } as unknown as ManagersStub["registryManager"],
    eventBus: {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    } as unknown as ManagersStub["eventBus"],
    renderEvents: renderEvents as unknown as ManagersStub["renderEvents"],
    entityEvents: entityEvents as unknown as ManagersStub["entityEvents"],
    __renderListeners: renderListeners,
    __entityListeners: entityListeners,
  };
}

describe("DebugPanel", () => {
  beforeEach(() => {
    useDuckFlowManagersMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders runtime summary, metrics, and toggles visibility", () => {
    const managers = createManagers();
    useDuckFlowManagersMock.mockReturnValue(managers);

    render(<DebugPanel defaultOpen position="left" />);

    const panel = screen.getByRole("complementary");
    expect(panel.getAttribute("aria-hidden")).toBe("false");

    expect(screen.getByText("DuckFlow Debug")).toBeInTheDocument();
    expect(screen.getByText(/Runtime: RuntimeStub/)).toBeInTheDocument();
    expect(screen.getByText("Entities: 2")).toBeInTheDocument();
    expect(screen.getByText("Queue: 2")).toBeInTheDocument();

    expect(screen.getByText("Lifecycle")).toBeInTheDocument();
    expect(screen.getByText("init")).toBeInTheDocument();
    expect(screen.queryByText("idle")).toBeNull();

    expect(screen.getByRole("list", { name: "Render duration distribution" })).toBeInTheDocument();
    expect(screen.getByText("Renderer: canvas · Entity: node")).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /debug/i });
    fireEvent.click(toggle);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(toggle);
    expect(panel.getAttribute("aria-hidden")).toBe("false");
  });

  it("records render and entity events when tracking is enabled", async () => {
    const managers = createManagers();
    useDuckFlowManagersMock.mockReturnValue(managers);

    render(<DebugPanel defaultOpen eventTracking />);

    await waitFor(() => {
      expect(managers.__renderListeners.renderAll.length).toBeGreaterThan(0);
    });

    const renderAllListener = managers.__renderListeners.renderAll[0];
    const entityAddedListener = managers.__entityListeners.added[0];

    act(() => {
      renderAllListener?.({ batch: "all" });
    });

    act(() => {
      entityAddedListener?.(createEntity("node-99", "node"));
    });

    expect(await screen.findByText("render:all")).toBeInTheDocument();
    expect(screen.getByText("entity:added")).toBeInTheDocument();
    expect(screen.getByText(/"batch": "all"/)).toBeInTheDocument();
    expect(screen.getByText(/"id": "node-99"/)).toBeInTheDocument();

    const timelineMarkers = await screen.findAllByTitle(/render:all|entity:added/);
    expect(timelineMarkers.length).toBeGreaterThan(0);
  });

  it("shows event tracking hint when disabled", () => {
    const managers = createManagers();
    useDuckFlowManagersMock.mockReturnValue(managers);

    render(<DebugPanel />);

    expect(screen.getByText(/Event tracking disabled. Pass/)).toBeInTheDocument();
  });
});
