import type { Attributes, ObservableGauge } from "../../metrics";
import { ScopedMeter, getMetricsProvider } from "../../metrics";
import type { RenderMetricSummary, RenderStats } from "./types";

type SummaryMap = Map<string, number>;

function mapToRecord(map: SummaryMap): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of map) {
    result[key] = value;
  }
  return result;
}

export interface RenderManagerMetricsOptions {
  meter: ScopedMeter;
  getQueueSize: () => number;
  getDirtyRegionCount: () => number;
  getDirtyEntityCount: () => number;
  isFullRedrawPending: () => boolean;
  getRenderResultsSize: () => number;
  getRendererNames: () => string[];
  getDefaultRenderer: () => string;
}

export class RenderManagerMetrics {
  readonly meter: ScopedMeter;
  private readonly options: RenderManagerMetricsOptions;
  private queueGauge: ObservableGauge | undefined;
  private readonly queueGaugeCallback: (
    observe: (o: { value: number; attributes?: Record<string, string | number | boolean> }) => void
  ) => void;
  private readonly lifecycleCounter;
  private readonly connectionCounter;
  private readonly redrawScheduledCounter;
  private readonly redrawRequestedCounter;
  private readonly eventBridgeCounter;
  private readonly errorCounter;
  private readonly dirtyFallbackCounter;
  private readonly contextCounter;
  private readonly schedulerBackpressureCounter;

  private readonly lifecycleSummary: SummaryMap = new Map();
  private readonly connectionSummary: SummaryMap = new Map();
  private readonly redrawScheduledSummary: SummaryMap = new Map();
  private readonly redrawRequestedSummary: SummaryMap = new Map();
  private readonly redrawReasonSummary: SummaryMap = new Map();
  private readonly eventBridgeSummary: SummaryMap = new Map();
  private readonly errorSummary: SummaryMap = new Map();
  private readonly dirtyFallbackSummary: SummaryMap = new Map();
  private readonly contextSummary: SummaryMap = new Map();
  private readonly schedulerBackpressureSummary: SummaryMap = new Map();

  constructor(options: RenderManagerMetricsOptions) {
    this.options = options;
    this.meter = options.meter;

    this.queueGaugeCallback = (observe) => {
      observe({ value: this.options.getQueueSize() });
    };

    const gauge = this.meter.observableGauge("queue.size", {
      description: "Number of entities tracked for rendering",
      unit: "count",
    });
    gauge.addCallback(this.queueGaugeCallback);
    this.queueGauge = gauge;

    this.lifecycleCounter = this.meter.counter("lifecycle.events", {
      description: "Render manager lifecycle transitions",
      unit: "count",
    });
    this.connectionCounter = this.meter.counter("connections", {
      description: "Render manager connection events",
      unit: "count",
    });
    this.redrawScheduledCounter = this.meter.counter("redraw.scheduled", {
      description: "Redraw scheduling requests",
      unit: "count",
    });
    this.redrawRequestedCounter = this.meter.counter("redraw.requests", {
      description: "Full redraw requests by reason",
      unit: "count",
    });
    this.eventBridgeCounter = this.meter.counter("event_bridge.transitions", {
      description: "Render event bridge attach/detach transitions",
      unit: "count",
    });
    this.errorCounter = this.meter.counter("errors", {
      description: "Render manager error occurrences",
      unit: "count",
    });
    this.dirtyFallbackCounter = this.meter.counter("dirty.fallbacks", {
      description: "Fallbacks to full redraw when partial updates fail",
      unit: "count",
    });
    this.contextCounter = this.meter.counter("context.operations", {
      description: "Render context mutations",
      unit: "count",
    });
    this.schedulerBackpressureCounter = this.meter.counter("scheduler.backpressure", {
      description: "Render frame scheduler backpressure transitions",
      unit: "count",
    });
  }

  private increment(summary: SummaryMap, key: string, delta = 1): void {
    if (!key) {
      return;
    }
    summary.set(key, (summary.get(key) ?? 0) + delta);
  }

  private mergeAttributes(base: Attributes | undefined, extra: Attributes): Attributes {
    return base ? { ...base, ...extra } : { ...extra };
  }

  recordLifecycle(event: "init" | "dispose", attributes?: Attributes): void {
    const attrs = this.mergeAttributes(attributes, { event });
    this.lifecycleCounter.add(1, attrs);
    this.increment(this.lifecycleSummary, event);
  }

  recordConnection(target: "entity" | "registry", attributes?: Attributes): void {
    const attrs = this.mergeAttributes(attributes, { target });
    this.connectionCounter.add(1, attrs);
    this.increment(this.connectionSummary, target);
  }

  recordContextOperation(operation: "set" | "update"): void {
    this.contextCounter.add(1, { operation });
    this.increment(this.contextSummary, operation);
  }

  recordRedrawScheduled(kind: "full" | "partial", trigger?: string): void {
    const attrs: Attributes = trigger ? { kind, trigger } : { kind };
    this.redrawScheduledCounter.add(1, attrs);
    this.increment(this.redrawScheduledSummary, kind);
  }

  recordFullRedrawRequest(reason: string): void {
    const normalized = reason || "unknown";
    this.redrawRequestedCounter.add(1, { reason: normalized });
    this.increment(this.redrawRequestedSummary, "full");
    this.increment(this.redrawReasonSummary, normalized);
  }

  recordEventBridge(event: "attach" | "detach" | "detach_error"): void {
    this.eventBridgeCounter.add(1, { event });
    this.increment(this.eventBridgeSummary, event);
  }

  recordError(type: string): void {
    const normalized = type || "unknown";
    this.errorCounter.add(1, { type: normalized });
    this.increment(this.errorSummary, normalized);
  }

  recordDirtyFallback(kind: string, reason?: string): void {
    const normalizedKind = kind || "unknown";
    this.dirtyFallbackCounter.add(1, {
      kind: normalizedKind,
      reason: reason ?? "unknown",
    });
    this.increment(this.dirtyFallbackSummary, normalizedKind);
  }

  recordSchedulerBackpressure(event: "triggered" | "relieved", attributes?: Attributes): void {
    const attrs = this.mergeAttributes(attributes, { event });
    this.schedulerBackpressureCounter.add(1, attrs);
    this.increment(this.schedulerBackpressureSummary, event);
  }

  private getSummary(): RenderMetricSummary {
    return {
      lifecycle: mapToRecord(this.lifecycleSummary),
      connections: mapToRecord(this.connectionSummary),
      context: mapToRecord(this.contextSummary),
      redrawScheduled: mapToRecord(this.redrawScheduledSummary),
      redrawRequested: mapToRecord(this.redrawRequestedSummary),
      redrawReasons: mapToRecord(this.redrawReasonSummary),
      eventBridge: mapToRecord(this.eventBridgeSummary),
      errors: mapToRecord(this.errorSummary),
      dirtyFallbacks: mapToRecord(this.dirtyFallbackSummary),
      schedulerBackpressure: mapToRecord(this.schedulerBackpressureSummary),
    };
  }

  getRenderStats(): RenderStats {
    const provider = getMetricsProvider();
    provider.collect?.();
    const renderMeter = provider.snapshot?.()?.meters.find((m) => m.scope === "render");

    return {
      queueSize: this.options.getQueueSize(),
      dirtyRegionCount: this.options.getDirtyRegionCount(),
      dirtyEntityCount: this.options.getDirtyEntityCount(),
      pendingFullRedraw: this.options.isFullRedrawPending(),
      metricsSummary: this.getSummary(),
      metrics: renderMeter,
    };
  }

  getPerformanceStats(): {
    totalRenderTime: number;
    renderCount: number;
    cacheHitCount: number;
    cacheMissCount: number;
    averageRenderTime: number;
    name: string;
    type: string;
    renderers: string[];
    totalRenderers: number;
    defaultRenderer: string;
  } {
    const rendererNames = this.options.getRendererNames();

    return {
      totalRenderTime: 0,
      renderCount: this.options.getRenderResultsSize(),
      cacheHitCount: 0,
      cacheMissCount: 0,
      averageRenderTime: 0,
      name: "RenderManager",
      type: "manager",
      renderers: rendererNames,
      totalRenderers: rendererNames.length,
      defaultRenderer: this.options.getDefaultRenderer(),
    };
  }

  dispose(): void {
    if (this.queueGauge) {
      this.queueGauge.removeCallback(this.queueGaugeCallback);
      this.queueGauge = undefined;
    }
  }
}
