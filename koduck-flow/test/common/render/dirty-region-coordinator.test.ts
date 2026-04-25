import { beforeEach, describe, expect, it, vi } from "vitest";

import { DirtyRegionCoordinator } from "../../../src/common/render/render-manager/dirty-region-coordinator";
import type { RenderMetricsModule } from "../../../src/common/render/render-manager/render-metrics-module";
import type { RenderFrameScheduler } from "../../../src/common/render/render-manager/render-frame-scheduler";
import type { IEntity } from "../../../src/common/entity/types";
import type { IEntityLifecycleTracker } from "../../../src/common/render/render-manager/contracts";

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

vi.mock("../../src/common/render/render-diagnostics", () => ({
  diagnostics: diagnosticsMock,
}));

vi.mock("../../src/common/logger", () => {
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

const createMetricsStub = () => {
  const meter = {
    counter: vi.fn(() => ({ add: vi.fn() })),
    histogram: vi.fn(() => ({ record: vi.fn() })),
    gauge: vi.fn(() => ({ set: vi.fn() })),
  };

  const metrics = {
    meter: meter as unknown,
    recordError: vi.fn(),
    recordRedrawScheduled: vi.fn(),
    recordFullRedrawRequest: vi.fn(),
    recordDirtyFallback: vi.fn(),
  };

  return {
    stub: metrics as unknown as RenderMetricsModule,
    spies: metrics,
  };
};

const createFrameSchedulerStub = (shouldSchedule = true) => {
  const scheduledTasks: Array<() => void> = [];
  const scheduler = {
    scheduleRedraw: vi.fn((task: () => void) => {
      scheduledTasks.push(task);
      return shouldSchedule;
    }),
    setFullRedrawPending: vi.fn(),
    isFullRedrawPending: vi.fn().mockReturnValue(false),
    isBackpressureActive: vi.fn().mockReturnValue(false),
    runOnNextFrame: vi.fn((callback: () => void) => callback()),
  };

  return {
    stub: scheduler as unknown as RenderFrameScheduler,
    spies: scheduler,
    tasks: scheduledTasks,
  };
};

const createCoordinator = (options?: { shouldSchedule?: boolean }) => {
  const metrics = createMetricsStub();
  const frameScheduler = createFrameSchedulerStub(options?.shouldSchedule);
  const onFullRedraw = vi.fn();
  const onPartialFlush = vi.fn();

  const coordinator = new DirtyRegionCoordinator({
    metrics: metrics.stub,
    frameScheduler: frameScheduler.stub,
    onFullRedraw,
    onPartialFlush,
  });

  return {
    coordinator,
    metrics,
    frameScheduler,
    onFullRedraw,
    onPartialFlush,
    manager: coordinator.getManager(),
  };
};

describe("DirtyRegionCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to full redraw when no tracker is attached", () => {
    const { coordinator, metrics, onFullRedraw, frameScheduler } = createCoordinator();

    const result = coordinator.markEntityDirtyById("missing", "hydrate");

    expect(result).toBe(false);
    expect(metrics.spies.recordDirtyFallback).toHaveBeenCalledWith("missing_tracker", "hydrate");
    expect(metrics.spies.recordFullRedrawRequest).toHaveBeenCalledWith("hydrate:missing_tracker");
    expect(onFullRedraw).toHaveBeenCalledWith("hydrate:missing_tracker");
    expect(frameScheduler.spies.setFullRedrawPending).toHaveBeenCalledWith(true);
  });

  it("records fallback when tracker cannot mark entity dirty", () => {
    const { coordinator, metrics } = createCoordinator();
    const tracker = {
      markEntityDirtyById: vi.fn().mockReturnValue(false),
      getEntities: vi.fn().mockReturnValue([]),
    } as unknown as IEntityLifecycleTracker;

    coordinator.attachEntityTracker(tracker);

    const result = coordinator.markEntityDirtyById("ghost", "update");

    expect(result).toBe(false);
    expect(tracker.markEntityDirtyById).toHaveBeenCalledWith("ghost", "update");
    expect(metrics.spies.recordDirtyFallback).toHaveBeenCalledWith("mark_entity_dirty", "update");
  });

  it("schedules full redraw and handles executor errors", () => {
    const { coordinator, metrics, frameScheduler, manager } = createCoordinator({
      shouldSchedule: true,
    });

    const resetSpy = vi.spyOn(manager, "resetForFullRedraw");
    const renderExecutor = vi.fn(() => {
      throw new Error("boom");
    });
    const entityUpdate = vi.fn();
    coordinator.setRenderExecutor(renderExecutor, entityUpdate);

    coordinator.scheduleRedraw("panic");

    expect(frameScheduler.spies.scheduleRedraw).toHaveBeenCalled();
    expect(metrics.spies.recordRedrawScheduled).toHaveBeenCalledWith("full", "panic");
    expect(resetSpy).toHaveBeenCalledTimes(1);

    const task = frameScheduler.tasks.at(-1);
    expect(task).toBeTypeOf("function");
    task?.();

    expect(renderExecutor).toHaveBeenCalledTimes(1);
    expect(entityUpdate).not.toHaveBeenCalled();
    expect(metrics.spies.recordError).toHaveBeenCalledWith("entity_update_callback");
    expect(resetSpy).toHaveBeenCalledTimes(2);
  });

  it("coalesces redraw when frame already scheduled", () => {
    const { coordinator, metrics, manager } = createCoordinator({
      shouldSchedule: false,
    });
    const resetSpy = vi.spyOn(manager, "resetForFullRedraw");

    coordinator.scheduleRedraw("coalesce");

    expect(metrics.spies.recordRedrawScheduled).toHaveBeenCalledWith("full", "coalesce");
    expect(resetSpy).not.toHaveBeenCalled();
  });

  it("delegates dirty operations to the manager", () => {
    const { coordinator, manager, frameScheduler } = createCoordinator();
    const entity = { id: "node-1" } as IEntity;

    const markSpy = vi.spyOn(manager, "markEntityDirty").mockReturnValue(true);
    const flushSpy = vi.spyOn(manager, "schedulePartialFlush");

    expect(coordinator.markEntityDirty(entity, "touch")).toBe(true);
    expect(markSpy).toHaveBeenCalledWith(entity, "touch");

    coordinator.scheduleDirtyFlush();
    expect(flushSpy).toHaveBeenCalledTimes(1);

    coordinator.setFullRedrawPending(true);
    expect(frameScheduler.spies.setFullRedrawPending).toHaveBeenCalledWith(true);
    coordinator.isFullRedrawPending();
    expect(frameScheduler.spies.isFullRedrawPending).toHaveBeenCalled();
  });
});
