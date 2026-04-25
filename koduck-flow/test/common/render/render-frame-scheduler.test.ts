import { beforeEach, describe, expect, it, vi } from "vitest";

const schedulerLogSpies = vi.hoisted(() => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const baseLoggerSpies = vi.hoisted(() => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  withContext: vi.fn(() => schedulerLogSpies),
  child: vi.fn(() => schedulerLogSpies),
}));

vi.mock("../../../src/common/logger", () => ({
  logger: baseLoggerSpies,
}));

const { RenderFrameScheduler, RenderFrameSchedulerEvent } = await import(
  "../../../src/common/render/render-manager/render-frame-scheduler"
);

const createSchedulerHarness = (options?: {
  frameBudgetMs?: number;
  backpressureLogIntervalMs?: number;
}) => {
  const callbacks: Array<(time: number) => void> = [];
  const clock = {
    value: 0,
    now: () => clock.value,
    advance(ms: number) {
      clock.value += ms;
    },
  };

  const scheduler = new RenderFrameScheduler({
    frameBudgetMs: options?.frameBudgetMs,
    backpressureLogIntervalMs: options?.backpressureLogIntervalMs,
    now: clock.now,
    raf: (cb) => {
      callbacks.push(cb);
      return callbacks.length;
    },
  });

  const flush = () => {
    const cb = callbacks.shift();
    expect(cb).toBeDefined();
    cb?.(clock.value);
  };

  return { scheduler, clock, callbacks, flush };
};

describe("RenderFrameScheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes higher priority tasks first and clears pending flags", () => {
    const { scheduler, clock, flush } = createSchedulerHarness();
    const order: string[] = [];

    const first = scheduler.scheduleRedraw(
      () => {
        order.push("critical");
        clock.advance(1);
      },
      { priority: "critical", label: "critical" }
    );
    const second = scheduler.scheduleRedraw(
      () => {
        order.push("custom");
        clock.advance(1);
      },
      { priority: 250, label: "custom" }
    );
    const third = scheduler.scheduleRedraw(
      () => {
        order.push("low");
        clock.advance(1);
      },
      { priority: "low", label: "low" }
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(third).toBe(false);
    expect(scheduler.isRedrawScheduled()).toBe(true);
    expect(scheduler.isFullRedrawPending()).toBe(true);

    flush();

    expect(order).toEqual(["critical", "custom", "low"]);
    expect(scheduler.isRedrawScheduled()).toBe(false);
    expect(scheduler.isFullRedrawPending()).toBe(false);
  });

  it("enforces frame budget, requeues deferred tasks, and logs backpressure", () => {
    const { scheduler, clock, flush } = createSchedulerHarness({
      frameBudgetMs: 8,
      backpressureLogIntervalMs: 1,
    });

    const listener = vi.fn();
    scheduler.setBackpressureListener(listener);

    const executed: string[] = [];
    scheduler.scheduleRedraw(
      () => {
        executed.push("first");
        clock.advance(3);
      },
      { label: "first", estimatedDurationMs: 3 }
    );
    scheduler.scheduleRedraw(
      () => {
        executed.push("second");
        clock.advance(6);
      },
      { label: "second", estimatedDurationMs: 6 }
    );
    scheduler.scheduleRedraw(
      () => {
        executed.push("third");
        clock.advance(2);
      },
      { label: "third", estimatedDurationMs: 2 }
    );

    clock.advance(5);
    flush();

    expect(executed).toEqual(["first", "second"]);
    expect(listener).toHaveBeenCalled();
    const triggered = listener.mock.calls.find(([event]) => event.active);
    expect(triggered?.[0]).toMatchObject({
      active: true,
      reason: "triggered",
      metadata: expect.objectContaining({
        deferred: 1,
        queueSize: 1,
        budgetMs: 8,
      }),
    });
    expect(scheduler.isBackpressureActive()).toBe(true);
    expect(
      schedulerLogSpies.info.mock.calls.some(
        ([arg]) => arg.event === RenderFrameSchedulerEvent.BackpressureTriggered
      )
    ).toBe(true);

    clock.advance(5);
    scheduler.scheduleRedraw(
      () => {
        executed.push("extra");
        clock.advance(1);
      },
      { label: "extra" }
    );

    expect(
      schedulerLogSpies.debug.mock.calls.some(
        ([arg]) =>
          arg.event === RenderFrameSchedulerEvent.BackpressureTriggered &&
          arg.metadata?.reason === "queue_growing"
      )
    ).toBe(true);

    flush();

    expect(executed).toEqual(["first", "second", "third", "extra"]);
    expect(scheduler.isBackpressureActive()).toBe(false);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ active: false, reason: "relieved" })
    );
    expect(
      schedulerLogSpies.info.mock.calls.some(
        ([arg]) => arg.event === RenderFrameSchedulerEvent.BackpressureRelieved
      )
    ).toBe(true);
  });

  it("allows budget bypass tasks to run while deferring the remainder", () => {
    const { scheduler, clock, flush } = createSchedulerHarness({
      frameBudgetMs: 4,
      backpressureLogIntervalMs: 0,
    });

    const listener = vi.fn();
    scheduler.setBackpressureListener(listener);

    const executed: string[] = [];
    scheduler.scheduleRedraw(
      () => {
        executed.push("first");
        clock.advance(2);
      },
      { label: "first" }
    );
    scheduler.scheduleRedraw(
      () => {
        executed.push("bypass");
        clock.advance(5);
      },
      { label: "bypass", allowBudgetBypass: true }
    );
    scheduler.scheduleRedraw(
      () => {
        executed.push("third");
        clock.advance(1);
      },
      { label: "third" }
    );

    flush();

    expect(executed).toEqual(["first", "bypass"]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, reason: "triggered" })
    );

    flush();

    expect(executed).toEqual(["first", "bypass", "third"]);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ active: false, reason: "relieved" })
    );
  });

  it("logs task execution failures and supports runOnNextFrame callbacks", () => {
    const { scheduler, clock, callbacks, flush } = createSchedulerHarness({
      backpressureLogIntervalMs: 0,
    });

    const nextFrame = vi.fn(() => clock.advance(1));
    scheduler.runOnNextFrame(nextFrame);
    expect(callbacks).toHaveLength(1);
    flush();
    expect(nextFrame).toHaveBeenCalledTimes(1);

    scheduler.scheduleRedraw(
      () => {
        clock.advance(1);
        throw new Error("boom");
      },
      { label: "failure" }
    );

    flush();

    expect(schedulerLogSpies.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: RenderFrameSchedulerEvent.TaskExecutionFailed,
        metadata: expect.objectContaining({ label: "failure" }),
      })
    );
  });
});
