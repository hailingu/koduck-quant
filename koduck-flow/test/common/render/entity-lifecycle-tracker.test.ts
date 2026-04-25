import { beforeEach, describe, expect, it, vi } from "vitest";

import { EntityLifecycleTracker } from "../../../src/common/render/render-manager/entity-lifecycle-tracker";
import type { IEntity } from "../../../src/common/entity/types";
import type { DirtyRegionManager } from "../../../src/common/render/render-manager/dirty-region-manager";
import type { VisibilityModule } from "../../../src/common/render/render-manager/visibility";
import type { ScopedMeter } from "../../../src/common/metrics";
import type { IRenderContext, IRenderStrategy } from "../../../src/common/render/types";

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

vi.mock("../../../src/common/logger", () => {
  const noop = vi.fn();
  const create = () => ({
    info: noop,
    debug: noop,
    warn: noop,
    error: noop,
    time: noop,
    timeEnd: noop,
  });
  return {
    logger: {
      info: noop,
      debug: noop,
      warn: noop,
      error: noop,
      withContext: vi.fn(() => create()),
      child: vi.fn(() => create()),
    },
  };
});

const rendererModuleMock = vi.hoisted(() => {
  const renderEntity = vi.fn();
  const renderAllEntities = vi.fn();
  const markEntityDirtyById = vi.fn();
  return {
    renderEntity,
    renderAllEntities,
    markEntityDirtyById,
  };
});

const renderEntityMock = rendererModuleMock.renderEntity;
const renderAllEntitiesMock = rendererModuleMock.renderAllEntities;
const markEntityDirtyByIdHelperMock = rendererModuleMock.markEntityDirtyById;

vi.mock("../../../src/common/render/render-manager/entity-lifecycle-renderer", () => ({
  renderEntity: rendererModuleMock.renderEntity,
  renderAllEntities: rendererModuleMock.renderAllEntities,
  markEntityDirtyById: rendererModuleMock.markEntityDirtyById,
}));

type CounterCall = { name: string; add: ReturnType<typeof vi.fn> };

const createVisibilityStub = () => {
  const stub = {
    markEntityVisible: vi.fn(),
    markEntityInvisible: vi.fn(),
    isEntityVisibleInView: vi.fn().mockReturnValue(false),
    getVisibleEntities: vi.fn().mockReturnValue(new Set<string>()),
    setViewVisibility: vi.fn(),
    clearViewVisibility: vi.fn(),
    clearEntityVisibility: vi.fn(),
    getViewsForEntity: vi.fn().mockReturnValue(new Set<string>()),
    clearAll: vi.fn(),
  };

  return {
    stub,
    instance: stub as unknown as VisibilityModule,
  };
};

const createMeterStub = () => {
  const calls: CounterCall[] = [];
  const counter = vi.fn((name: string) => {
    const add = vi.fn();
    calls.push({ name, add });
    return { add };
  });
  const meter = {
    counter,
    histogram: vi.fn(() => ({ record: vi.fn() })),
    gauge: vi.fn(() => ({ set: vi.fn() })),
    observableGauge: vi.fn(() => ({ addCallback: vi.fn(), removeCallback: vi.fn() })),
  };

  return {
    meter: meter as unknown as ScopedMeter,
    counter,
    calls,
  };
};

const createTracker = (overrides?: {
  markEntityDirty?: (entity: IEntity, reason: string) => boolean;
  resolveExternalEntity?: (entityId: string) => IEntity | undefined;
  createStrategyContext?: (entity: IEntity) => IRenderContext;
}) => {
  const meter = createMeterStub();
  const visibility = createVisibilityStub();
  const dirtyRegionManagerStub = {
    markEntityDirty: vi.fn().mockImplementation(overrides?.markEntityDirty ?? (() => true)),
    schedulePartialFlush: vi.fn(),
  };
  const scheduleDirtyFlush = vi.fn();
  const requestFullRedraw = vi.fn();

  const tracker = new EntityLifecycleTracker({
    dirtyRegionManager: dirtyRegionManagerStub as unknown as DirtyRegionManager,
    visibilityModule: visibility.instance,
    meter: meter.meter,
    scheduleDirtyFlush,
    requestFullRedraw,
    ...(overrides?.createStrategyContext && {
      createStrategyContext: overrides.createStrategyContext,
    }),
    ...(overrides?.resolveExternalEntity && {
      resolveExternalEntity: overrides.resolveExternalEntity,
    }),
  });

  return {
    tracker,
    dirtyRegionManager: dirtyRegionManagerStub,
    visibility: visibility.stub,
    scheduleDirtyFlush,
    requestFullRedraw,
    meter,
  };
};

const createEntity = (id: string, overrides: Partial<IEntity> = {}): IEntity =>
  ({
    id,
    type: "node",
    dispose: vi.fn(),
    ...overrides,
  }) as unknown as IEntity;

describe("EntityLifecycleTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bootstrap marks entities dirty when requested", () => {
    const ctx = createTracker();
    const entityA = createEntity("a");
    const entityB = createEntity("b");

    const initialized = ctx.tracker.bootstrap([entityA, entityB], { markDirty: true });

    expect(initialized).toBe(2);
    expect(ctx.dirtyRegionManager.markEntityDirty).toHaveBeenCalledTimes(2);
    expect(ctx.scheduleDirtyFlush).toHaveBeenCalledTimes(2);
  });

  it("addEntity schedules dirty flush when marked", () => {
    const ctx = createTracker();
    const entity = createEntity("x");

    ctx.tracker.addEntity(entity);

    expect(ctx.meter.counter).toHaveBeenCalledWith("queue.add");
    expect(ctx.dirtyRegionManager.markEntityDirty).toHaveBeenCalledWith(entity, "add");
    expect(ctx.scheduleDirtyFlush).toHaveBeenCalled();
  });

  it("addEntity respects markDirty flag", () => {
    const ctx = createTracker();
    const entity = createEntity("y");

    ctx.tracker.addEntity(entity, { markDirty: false });

    expect(ctx.dirtyRegionManager.markEntityDirty).not.toHaveBeenCalled();
    expect(ctx.scheduleDirtyFlush).not.toHaveBeenCalled();
  });

  it("removeEntity handles missing entries", () => {
    const ctx = createTracker();

    ctx.tracker.removeEntity("ghost");

    expect(ctx.meter.counter).toHaveBeenCalledWith("queue.remove.miss");
    expect(ctx.requestFullRedraw).not.toHaveBeenCalled();
  });

  it("removeEntity clears state and schedules flush", () => {
    const ctx = createTracker();
    const entity = createEntity("z");

    ctx.tracker.addEntity(entity);
    ctx.scheduleDirtyFlush.mockClear();
    ctx.dirtyRegionManager.markEntityDirty.mockClear();

    ctx.tracker.removeEntity(entity.id);

    expect(ctx.dirtyRegionManager.markEntityDirty).toHaveBeenCalledWith(entity, "remove");
    expect(ctx.scheduleDirtyFlush).toHaveBeenCalled();
    expect(ctx.visibility.clearEntityVisibility).toHaveBeenCalledWith(entity.id);
  });

  it("markEntityDirty delegates to manager", () => {
    const ctx = createTracker();
    const entity = createEntity("dirty");

    ctx.dirtyRegionManager.markEntityDirty.mockReturnValueOnce(true as unknown as boolean);

    const result = ctx.tracker.markEntityDirty(entity, "update");

    expect(result).toBe(true);
    expect(ctx.dirtyRegionManager.markEntityDirty).toHaveBeenCalledWith(entity, "update");
  });

  it("markEntityDirtyById uses helper module", () => {
    const ctx = createTracker();
    markEntityDirtyByIdHelperMock.mockReturnValueOnce(true);

    const outcome = ctx.tracker.markEntityDirtyById("helper", "reason");

    expect(outcome).toBe(true);
    expect(markEntityDirtyByIdHelperMock).toHaveBeenCalledWith(
      "helper",
      "reason",
      expect.objectContaining({
        renderEntities: expect.any(Map),
        dirtyRegionManager: ctx.dirtyRegionManager,
      })
    );
  });

  it("render delegates to renderer helper", () => {
    const ctx = createTracker({
      createStrategyContext: () => ({
        nodes: [],
        viewport: { x: 0, y: 0, zoom: 1, width: 0, height: 0 },
        timestamp: 0,
      }),
    });
    const entity = createEntity("render-me");
    ctx.tracker.addEntity(entity, { markDirty: false });
    renderEntityMock.mockReturnValueOnce("rendered");

    const result = ctx.tracker.render(entity.id);

    expect(renderEntityMock).toHaveBeenCalledWith(
      entity.id,
      expect.objectContaining({
        renderEntities: expect.any(Map),
        renderStrategy: undefined,
      })
    );
    expect(result).toBe("rendered");
  });

  it("renderAll delegates to renderer helper", () => {
    const ctx = createTracker();
    const artifacts = {
      renderer: undefined,
      context: undefined,
      canvas: undefined,
      c2d: undefined,
    };

    ctx.tracker.renderAll(() => artifacts);

    expect(renderAllEntitiesMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        renderEntities: expect.any(Map),
      })
    );
  });

  it("exposes render state accessors and configuration hooks", () => {
    const ctx = createTracker();
    const entity = createEntity("stateful");
    ctx.tracker.addEntity(entity, { markDirty: false });

    const strategy = { selectOptimalRenderer: vi.fn() } as unknown as IRenderStrategy;
    const customContext = vi.fn();
    const resolver = vi.fn();

    ctx.tracker.setRenderStrategy(strategy);
    ctx.tracker.setStrategyContextBuilder(customContext);
    ctx.tracker.setExternalEntityResolver(resolver);

    renderEntityMock.mockImplementation((id, deps) => {
      deps.renderResults.set(id, {
        success: true,
        element: "rendered",
        rendererId: "mock",
        entityId: id,
        timestamp: 42,
      });
      return "rendered";
    });

    const result = ctx.tracker.render(entity.id);

    expect(result).toBe("rendered");
    expect(renderEntityMock).toHaveBeenCalledWith(
      entity.id,
      expect.objectContaining({
        renderStrategy: strategy,
        createStrategyContext: customContext,
        resolveExternalEntity: resolver,
      })
    );

    expect(ctx.tracker.getCachedRender(entity.id)).toEqual(
      expect.objectContaining({ rendererId: "mock", entityId: entity.id })
    );
    expect(ctx.tracker.getEntity(entity.id)).toBe(entity);
    expect(Array.from(ctx.tracker.getEntities())).toContain(entity);
    expect(ctx.tracker.getSize()).toBe(1);
    expect(ctx.tracker.getRenderResultsSize()).toBe(1);
    expect(ctx.tracker.getEntityMap().get(entity.id)).toBe(entity);

    ctx.tracker.markEntityVisible("view-1", entity.id);
    ctx.tracker.markEntityInvisible("view-1", entity.id);
    ctx.tracker.setViewVisibility("view-1", [entity.id]);
    ctx.tracker.clearViewVisibility("view-1");
    ctx.tracker.clearEntityVisibility(entity.id);

    expect(ctx.visibility.markEntityVisible).toHaveBeenCalledWith("view-1", entity.id);
    expect(ctx.visibility.markEntityInvisible).toHaveBeenCalledWith("view-1", entity.id);
    expect(ctx.visibility.setViewVisibility).toHaveBeenCalledWith("view-1", [entity.id]);
    expect(ctx.visibility.clearViewVisibility).toHaveBeenCalledWith("view-1");
    expect(ctx.visibility.clearEntityVisibility).toHaveBeenCalledWith(entity.id);
    expect(ctx.tracker.isEntityVisibleInView("view-1", entity.id)).toBe(false);
    expect(ctx.tracker.getVisibleEntities("view-1")).toBeInstanceOf(Set);
    expect(ctx.tracker.getViewsForEntity(entity.id)).toBeInstanceOf(Set);
  });

  it("scheduleDirtyFlush proxies to provided callback", () => {
    const ctx = createTracker();

    ctx.tracker.scheduleDirtyFlush();

    expect(ctx.scheduleDirtyFlush).toHaveBeenCalled();
  });

  it("dispose clears tracked state", () => {
    const ctx = createTracker();
    const entity = createEntity("dispose-me");
    ctx.tracker.addEntity(entity, { markDirty: false });

    ctx.tracker.dispose();

    expect(ctx.visibility.clearAll).toHaveBeenCalled();
  });
});
