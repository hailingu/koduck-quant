import { meter, ScopedMeter } from "../metrics";
import type {
  Counter,
  Gauge,
  Histogram,
  ObservableGauge,
  Observation,
} from "../metrics";

/**
 * Metrics collector
 * Responsible for collecting and monitoring event system performance metrics
 */
export class MetricsCollector {
  private readonly _m?: {
    meter: ScopedMeter;
    counters: {
      emitted: Counter;
      listenersInvoked: Counter;
      listenerErrors: Counter;
      listenerTimeouts: Counter;
    };
    gauges: {
      activeListeners: Gauge;
    };
    hist: {
      dispatchMs: Histogram;
    };
    batchDepth?: {
      og: ObservableGauge;
      cb: (observe: (o: Observation) => void) => void;
    };
  };

  constructor(eventName: string, getBatchCount: () => number) {
    // Initialize metrics tools, lazily created to avoid unnecessary overhead
    // Use event name attribute for scope division
    const base = new ScopedMeter(meter("event"), { event: eventName });
    this._m = {
      meter: base,
      counters: {
        emitted: base.counter("event_emitted_total", {
          description: "Total events emitted",
          unit: "count",
        }),
        listenersInvoked: base.counter("event_listeners_invoked_total", {
          description: "Total listeners invoked",
          unit: "count",
        }),
        listenerErrors: base.counter("event_listener_errors_total", {
          description: "Total listener errors",
          unit: "count",
        }),
        listenerTimeouts: base.counter("event_listener_timeout_total", {
          description: "Total listener soft-cancel (timeouts)",
          unit: "count",
        }),
      },
      gauges: {
        activeListeners: base.gauge("event_active_listeners", {
          description: "Current active listeners",
          unit: "count",
        }),
      },
      hist: {
        dispatchMs: base.histogram("event_dispatch_ms", {
          description: "Event dispatch duration",
          unit: "ms",
          // Leave boundaries empty, use provider defaults
        }),
      },
    };

    // Create observable gauge for current batch depth
    try {
      const og = this._m.meter.observableGauge("event_batch_queue_depth", {
        description: "Pending events in batch queue",
        unit: "count",
      });
      const cb = (observe: (o: Observation) => void) => {
        observe({ value: getBatchCount() });
      };
      og.addCallback(cb);
      this._m.batchDepth = { og, cb };
    } catch {
      /* no-op */ void 0; // Provider may not support observable gauges
    }
  }

  /**
   * Record event emission
   * @param mode Event mode (sync/async)
   */
  recordEmitted(mode: "sync" | "async"): void {
    try {
      this._m?.counters.emitted.add(1, { mode });
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * Record listener invocation
   * @param count Number of listeners invoked
   * @param mode Event mode (sync/async)
   */
  recordListenersInvoked(count: number, mode: "sync" | "async"): void {
    try {
      if (count > 0) {
        this._m?.counters.listenersInvoked.add(count, { mode });
      }
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * Record listener errors
   * @param count Number of errors
   * @param mode Event mode (sync/async)
   */
  recordListenerErrors(count: number, mode: "sync" | "async"): void {
    try {
      if (count > 0) {
        this._m?.counters.listenerErrors.add(count, { mode });
      }
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * Record listener timeouts
   * @param count Number of timeouts
   * @param mode Event mode (async)
   */
  recordListenerTimeouts(count: number, mode: "async"): void {
    try {
      if (count > 0) {
        this._m?.counters.listenerTimeouts.add(count, { mode });
      }
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * Record event dispatch duration
   * @param duration Duration in milliseconds
   * @param mode Event mode (sync/async)
   */
  recordDispatchDuration(duration: number, mode: "sync" | "async"): void {
    try {
      this._m?.hist.dispatchMs.record(duration, { mode });
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * Update active listener count
   * @param count Current listener count
   */
  updateActiveListeners(count: number): void {
    try {
      this._m?.gauges.activeListeners.set(count);
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * Clean up resources, remove observable gauge callbacks to avoid memory leaks
   */
  dispose(): void {
    try {
      const bd = this._m?.batchDepth;
      if (bd) {
        bd.og.removeCallback(bd.cb);
      }
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * Get metrics collector status
   */
  getStatus(): {
    initialized: boolean;
    hasBatchDepthGauge: boolean;
  } {
    return {
      initialized: !!this._m,
      hasBatchDepthGauge: !!this._m?.batchDepth,
    };
  }
}
