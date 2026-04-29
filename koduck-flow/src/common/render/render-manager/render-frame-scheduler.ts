/**
 * @module src/common/render/render-manager/render-frame-scheduler
 * requestAnimationFrame-based scheduler that enforces a frame budget, orders tasks by priority,
 * and emits backpressure events when the queue cannot finish within the current frame.
 */

import { logger } from "../../logger";

export type FrameTask = () => void;

export type FrameTaskPriority = "critical" | "high" | "normal" | "low";

export interface FrameTaskOptions {
  priority?: FrameTaskPriority | number;
  label?: string;
  estimatedDurationMs?: number;
  allowBudgetBypass?: boolean;
}

export type FrameBackpressureReason = "triggered" | "relieved";

export interface FrameBackpressureEvent {
  active: boolean;
  reason: FrameBackpressureReason;
  metadata?: {
    executed?: number;
    deferred?: number;
    queueSize: number;
    budgetMs?: number;
    frameDurationMs?: number;
    lastTaskDurationMs?: number;
    estimatedQueueDurationMs?: number;
  };
}

export const RenderFrameSchedulerEvent = {
  BackpressureTriggered: "render-frame-scheduler:backpressure-triggered",
  BackpressureRelieved: "render-frame-scheduler:backpressure-relieved",
  TaskExecutionFailed: "render-frame-scheduler:task-execution-failed",
} as const;

type FrameQueueEntry = {
  id: number;
  task: FrameTask;
  label: string;
  priorityValue: number;
  estimatedDuration: number;
  allowBudgetBypass: boolean;
  enqueuedAt: number;
};

const PRIORITY_WEIGHTS: Record<FrameTaskPriority, number> = {
  critical: 300,
  high: 200,
  normal: 100,
  low: 0,
};

const DEFAULT_FRAME_BUDGET_MS = 12;
const DEFAULT_BACKPRESSURE_LOG_INTERVAL_MS = 200;

const schedulerLogger = logger.withContext({
  tag: "render-manager:scheduler",
  metadata: { component: "RenderFrameScheduler" },
});

/**
 * Controls how many tasks are allowed to execute in a frame and defers the rest to later RAF ticks.
 * Priority ordering, budget checks, and backpressure events help callers degrade gracefully.
 */
export class RenderFrameScheduler {
  private readonly customRaf: ((cb: (time: number) => void) => unknown) | undefined;
  private readonly now: () => number;
  private readonly frameBudgetMs: number;
  private readonly backpressureLogIntervalMs: number;
  private redrawScheduled = false;
  private pendingFullRedraw = false;
  private readonly frameQueue: FrameQueueEntry[] = [];
  private sequence = 0;
  private backpressureActive = false;
  private lastBackpressureLogAt = 0;
  private backpressureListener: ((event: FrameBackpressureEvent) => void) | undefined;

  /**
   * Allows custom RAF, clock, or budget tuning when instantiating the scheduler.
   * @param options
   * @param options.raf
   * @param options.frameBudgetMs
   * @param options.backpressureLogIntervalMs
   * @param options.now
   */
  constructor(options?: {
    raf?: (cb: (time: number) => void) => unknown;
    frameBudgetMs?: number;
    backpressureLogIntervalMs?: number;
    now?: () => number;
  }) {
    this.customRaf = options?.raf;
    this.now = options?.now ?? (() => performance.now());
    const budget = options?.frameBudgetMs ?? DEFAULT_FRAME_BUDGET_MS;
    this.frameBudgetMs = Number.isFinite(budget) && budget > 0 ? budget : DEFAULT_FRAME_BUDGET_MS;
    const logInterval = options?.backpressureLogIntervalMs ?? DEFAULT_BACKPRESSURE_LOG_INTERVAL_MS;
    this.backpressureLogIntervalMs =
      Number.isFinite(logInterval) && logInterval > 0
        ? logInterval
        : DEFAULT_BACKPRESSURE_LOG_INTERVAL_MS;
  }

  /**
   * Enqueue a task for the next frame; if the frame budget is exceeded, remaining tasks are deferred.
   * @param task
   * @param options
   */
  scheduleRedraw(task: FrameTask, options?: FrameTaskOptions): boolean {
    const entry: FrameQueueEntry = {
      id: this.sequence++,
      task,
      label: options?.label ?? "frame-task",
      priorityValue: this.normalizePriority(options?.priority),
      estimatedDuration: Math.max(0, options?.estimatedDurationMs ?? 0),
      allowBudgetBypass: options?.allowBudgetBypass ?? false,
      enqueuedAt: this.now(),
    };

    this.enqueue(entry);
    const alreadyScheduled = this.redrawScheduled;
    this.pendingFullRedraw = true;

    if (!alreadyScheduled) {
      this.ensureAnimationFrameScheduled();
    } else if (this.backpressureActive) {
      this.maybeLogBackpressure("queue_growing");
    }

    return !alreadyScheduled;
  }

  /**
   * Execute a callback on the next RAF without touching the scheduler queue or metrics.
   * @param callback
   */
  runOnNextFrame(callback: FrameTask): void {
    const raf = this.resolveRaf();
    raf(() => callback());
  }

  /** Marks that a full redraw is pending so render strategies can schedule a large refresh. */
  markFullRedrawPending(): void {
    this.pendingFullRedraw = true;
  }

  /**
   * For testing and internal coordination, allow toggling the pending flag.
   * @param value
   */
  setFullRedrawPending(value: boolean): void {
    this.pendingFullRedraw = value;
  }

  /** Returns whether a full redraw is still pending. */
  isFullRedrawPending(): boolean {
    return this.pendingFullRedraw;
  }

  /** Returns true when a RAF callback has been scheduled but not yet executed. */
  isRedrawScheduled(): boolean {
    return this.redrawScheduled;
  }

  /** Number of queued tasks awaiting execution. */
  getQueueSize(): number {
    return this.frameQueue.length;
  }

  /** Frame budget in milliseconds. */
  getFrameBudgetMs(): number {
    return this.frameBudgetMs;
  }

  /** Whether backpressure is currently active. */
  isBackpressureActive(): boolean {
    return this.backpressureActive;
  }

  /**
   * Register or clear a listener for backpressure state changes.
   * @param listener
   */
  setBackpressureListener(listener?: (event: FrameBackpressureEvent) => void): void {
    this.backpressureListener = listener;
  }

  private enqueue(entry: FrameQueueEntry): void {
    this.frameQueue.push(entry);
  }

  private ensureAnimationFrameScheduled(): void {
    if (this.redrawScheduled) {
      return;
    }
    this.redrawScheduled = true;
    this.runOnNextFrame(() => this.flushFrameQueue());
  }

  private flushFrameQueue(): void {
    this.redrawScheduled = false;

    if (this.frameQueue.length === 0) {
      this.pendingFullRedraw = false;
      this.resetBackpressureIfNeeded();
      return;
    }

    const frameStart = this.now();
    const tasks = this.drainQueue();
    const deferred: FrameQueueEntry[] = [];
    let executed = 0;
    let lastDuration = 0;

    for (let index = 0; index < tasks.length; index += 1) {
      const entry = tasks[index];
      const elapsedBefore = this.now() - frameStart;

      if (!entry.allowBudgetBypass && executed > 0 && elapsedBefore >= this.frameBudgetMs) {
        deferred.push(entry, ...tasks.slice(index + 1));
        break;
      }

      const start = this.now();
      try {
        entry.task();
      } catch (error) {
        schedulerLogger.warn({
          event: RenderFrameSchedulerEvent.TaskExecutionFailed,
          message: "Frame task execution failed",
          emoji: "⚠️",
          metadata: {
            label: entry.label,
            priority: entry.priorityValue,
          },
          error,
        });
      }
      const end = this.now();
      lastDuration = end - start;
      executed += 1;

      if (
        !entry.allowBudgetBypass &&
        index < tasks.length - 1 &&
        end - frameStart >= this.frameBudgetMs
      ) {
        deferred.push(...tasks.slice(index + 1));
        break;
      }
    }

    if (deferred.length > 0) {
      this.requeueDeferred(deferred, {
        executed,
        frameStart,
        lastDuration,
      });
    } else if (this.frameQueue.length > 0) {
      // Tasks may have been enqueued while we were flushing.
      this.ensureAnimationFrameScheduled();
    }

    if (this.frameQueue.length === 0) {
      this.pendingFullRedraw = false;
      this.resetBackpressureIfNeeded();
    } else {
      this.pendingFullRedraw = true;
    }
  }

  private emitBackpressure(event: FrameBackpressureEvent): void {
    this.backpressureListener?.(event);
  }

  private drainQueue(): FrameQueueEntry[] {
    const entries = this.frameQueue.slice();
    this.frameQueue.length = 0;
    entries.sort((a, b) => {
      const priorityDelta = b.priorityValue - a.priorityValue;
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return a.id - b.id;
    });
    return entries;
  }

  private requeueDeferred(
    deferred: FrameQueueEntry[],
    context: { executed: number; frameStart: number; lastDuration: number }
  ): void {
    deferred.forEach((entry) => this.enqueue(entry));
    const now = this.now();
    const frameDuration = now - context.frameStart;
    const totalEstimated = this.estimateQueueDuration();

    this.backpressureActive = true;
    this.ensureAnimationFrameScheduled();

    this.emitBackpressure({
      active: true,
      reason: "triggered",
      metadata: {
        executed: context.executed,
        deferred: deferred.length,
        queueSize: this.frameQueue.length,
        budgetMs: this.frameBudgetMs,
        frameDurationMs: frameDuration,
        lastTaskDurationMs: context.lastDuration,
        estimatedQueueDurationMs: totalEstimated,
      },
    });

    this.logBackpressure(deferred.length, {
      executed: context.executed,
      frameDuration,
      lastDuration: context.lastDuration,
      totalEstimated,
      now,
    });
  }

  private estimateQueueDuration(): number {
    return this.frameQueue.reduce((sum, entry) => sum + entry.estimatedDuration, 0);
  }

  private resetBackpressureIfNeeded(): void {
    if (!this.backpressureActive) {
      return;
    }

    this.backpressureActive = false;
    const now = this.now();

    this.emitBackpressure({
      active: false,
      reason: "relieved",
      metadata: {
        queueSize: this.frameQueue.length,
        budgetMs: this.frameBudgetMs,
      },
    });

    if (!this.shouldLogBackpressure(now)) {
      return;
    }

    schedulerLogger.info({
      event: RenderFrameSchedulerEvent.BackpressureRelieved,
      message: "Render backpressure relieved; queue drained",
      emoji: "✅",
      metadata: {
        timestamp: now,
      },
    });
  }

  private logBackpressure(
    deferredCount: number,
    stats: {
      executed: number;
      frameDuration: number;
      lastDuration: number;
      totalEstimated: number;
      now: number;
    }
  ): void {
    if (!this.shouldLogBackpressure(stats.now)) {
      return;
    }

    schedulerLogger.info({
      event: RenderFrameSchedulerEvent.BackpressureTriggered,
      message: "Frame budget exceeded; deferring queued tasks",
      emoji: "🚦",
      metadata: {
        executed: stats.executed,
        deferred: deferredCount,
        queueSize: this.frameQueue.length,
        budgetMs: this.frameBudgetMs,
        frameDurationMs: Number(stats.frameDuration.toFixed(2)),
        lastTaskDurationMs: Number(stats.lastDuration.toFixed(2)),
        estimatedQueueDurationMs: Number(stats.totalEstimated.toFixed(2)),
        backpressureActive: this.backpressureActive,
      },
    });
  }

  private maybeLogBackpressure(reason: "queue_growing"): void {
    if (!this.backpressureActive) {
      return;
    }

    const now = this.now();
    if (!this.shouldLogBackpressure(now)) {
      return;
    }

    schedulerLogger.debug({
      event: RenderFrameSchedulerEvent.BackpressureTriggered,
      message: "Render queue still under backpressure",
      emoji: "🧭",
      metadata: {
        reason,
        queueSize: this.frameQueue.length,
      },
    });
  }

  private shouldLogBackpressure(now: number): boolean {
    if (now - this.lastBackpressureLogAt < this.backpressureLogIntervalMs) {
      return false;
    }
    this.lastBackpressureLogAt = now;
    return true;
  }

  private normalizePriority(priority: FrameTaskOptions["priority"]): number {
    if (typeof priority === "number" && Number.isFinite(priority)) {
      return priority;
    }
    if (priority && typeof priority === "string") {
      const normalized = priority;
      return PRIORITY_WEIGHTS[normalized] ?? PRIORITY_WEIGHTS.normal;
    }
    return PRIORITY_WEIGHTS.normal;
  }

  private resolveRaf(): (cb: (time: number) => void) => unknown {
    if (this.customRaf) {
      return this.customRaf;
    }
    const globalRaf = globalThis.requestAnimationFrame;
    if (typeof globalRaf === "function") {
      return globalRaf.bind(globalThis);
    }
    return (cb: (time: number) => void) => setTimeout(() => cb(performance.now()), 16);
  }
}
