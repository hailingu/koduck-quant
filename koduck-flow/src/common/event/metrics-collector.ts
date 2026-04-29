import { meter, ScopedMeter } from "../metrics";
import type {
  Counter,
  Gauge,
  Histogram,
  ObservableGauge,
  Observation,
} from "../metrics";

/**
 * 指标收集器
 * 负责事件系统的性能指标收集和监控
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
    // 初始化指标工具，延迟创建以避免不必要的开销
    // 使用事件名称属性进行作用域划分
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
          // 留空边界，使用提供者默认值
        }),
      },
    };

    // 为当前批次深度创建可观察计量器
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
      /* no-op */ void 0; // 提供者可能不支持可观察计量器
    }
  }

  /**
   * 记录事件发出
   * @param mode 事件模式（同步/异步）
   */
  recordEmitted(mode: "sync" | "async"): void {
    try {
      this._m?.counters.emitted.add(1, { mode });
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * 记录监听器调用
   * @param count 调用的监听器数量
   * @param mode 事件模式（同步/异步）
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
   * 记录监听器错误
   * @param count 错误数量
   * @param mode 事件模式（同步/异步）
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
   * 记录监听器超时
   * @param count 超时数量
   * @param mode 事件模式（异步）
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
   * 记录事件分发持续时间
   * @param duration 持续时间（毫秒）
   * @param mode 事件模式（同步/异步）
   */
  recordDispatchDuration(duration: number, mode: "sync" | "async"): void {
    try {
      this._m?.hist.dispatchMs.record(duration, { mode });
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * 更新活跃监听器数量
   * @param count 当前监听器数量
   */
  updateActiveListeners(count: number): void {
    try {
      this._m?.gauges.activeListeners.set(count);
    } catch {
      /* no-op */ void 0;
    }
  }

  /**
   * 清理资源，移除可观察计量器回调以避免内存泄漏
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
   * 获取指标收集器的状态
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
