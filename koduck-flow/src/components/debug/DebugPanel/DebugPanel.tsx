import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { IEntity } from "../../../common/entity";
import type { DirtyRegion, RenderMetricSummary } from "../../../common/render/render-manager/types";
import type { DebugPanelPosition } from "../../../common/runtime/debug-options";
import type { KoduckFlowRuntime, IManager } from "../../../common/runtime";
import type { HistogramPoint, MeterSnapshot } from "../../../common/metrics";
import { useKoduckFlowManagers } from "../../provider/hooks/useKoduckFlowRuntime";
import "./debug-panel.css";

const MAX_EVENT_HISTORY = 60;
const DEFAULT_METRIC_DISPLAY_LIMIT = 6;
const RUNTIME_CORE_MANAGERS = new Set(["entity", "render", "registry"]);
const RENDER_DURATION_METRIC = "render.duration.ms";
const EVENT_COLOR_PALETTE = [
  "#38bdf8",
  "#fb7185",
  "#facc15",
  "#a855f7",
  "#34d399",
  "#f97316",
  "#f472b6",
  "#22d3ee",
  "#bef264",
  "#fff1f2",
];

const METRIC_GROUPS: ReadonlyArray<{
  key: keyof RenderMetricSummary;
  label: string;
  maxItems?: number;
}> = [
  { key: "lifecycle", label: "Lifecycle" },
  { key: "connections", label: "Connections" },
  { key: "context", label: "Context Mutations" },
  { key: "redrawScheduled", label: "Redraw Scheduled" },
  { key: "redrawRequested", label: "Redraw Requests" },
  { key: "redrawReasons", label: "Redraw Reasons", maxItems: 8 },
  { key: "eventBridge", label: "Event Bridge" },
  { key: "errors", label: "Errors" },
  { key: "dirtyFallbacks", label: "Dirty Fallbacks" },
];

export type DebugPanelProps = {
  defaultOpen?: boolean;
  position?: DebugPanelPosition;
  eventTracking?: boolean;
};

type DebugEventRecord = {
  id: string;
  type: string;
  payload?: unknown;
  timestamp: number;
};

type RenderQueueEntry = {
  id: string;
  type: string;
};

type EntityGroup = {
  type: string;
  count: number;
};

type ManagerTopologyNode = {
  name: string;
  type: string;
  status: string;
  dependencies: string[];
  isCore: boolean;
  path?: string[];
};

type FlameGraphSegment = {
  key: string;
  label: string;
  total: number;
  count: number;
  average: number;
  percent: number;
};

type TimelineEvent = DebugEventRecord & {
  offset: number;
  color: string;
};

type EventTimeline = {
  events: TimelineEvent[];
  span: number;
  start: number;
  end: number;
};

function sliceEvents(next: DebugEventRecord[]): DebugEventRecord[] {
  if (next.length <= MAX_EVENT_HISTORY) {
    return next;
  }
  return next.slice(next.length - MAX_EVENT_HISTORY);
}

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

const DebugPanel: React.FC<DebugPanelProps> = ({
  defaultOpen = false,
  position = "right",
  eventTracking = false,
}) => {
  const { runtime, entityManager, renderManager, renderEvents, entityEvents } =
    useKoduckFlowManagers();

  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [entities, setEntities] = useState(() => entityManager.getEntities());
  const [renderQueue, setRenderQueue] = useState<RenderQueueEntry[]>(() => {
    return Array.from(renderManager.getTrackedEntities()).map(mapEntity);
  });
  const [renderStats, setRenderStats] = useState(() => renderManager.getRenderStats());
  const [dirtyRegions, setDirtyRegions] = useState<DirtyRegion[]>(() =>
    renderManager.getDirtyRegions()
  );
  const [dirtyEntityIds, setDirtyEntityIds] = useState<string[]>(() =>
    renderManager.getDirtyEntityIds()
  );
  const [eventHistory, setEventHistory] = useState<DebugEventRecord[]>([]);
  const eventColorMapRef = useRef<Map<string, string>>(new Map());

  const applySnapshots = useCallback(() => {
    setEntities(entityManager.getEntities());
    setRenderQueue(Array.from(renderManager.getTrackedEntities()).map(mapEntity));
    setRenderStats(renderManager.getRenderStats());
    setDirtyRegions(renderManager.getDirtyRegions());
    setDirtyEntityIds(renderManager.getDirtyEntityIds());
  }, [entityManager, renderManager]);

  useEffect(() => {
    applySnapshots();
    if (typeof globalThis.window === "undefined") {
      return;
    }
    const id = globalThis.setInterval(applySnapshots, 1500);
    return () => globalThis.clearInterval(id);
  }, [applySnapshots]);

  useEffect(() => {
    if (!eventTracking) {
      setEventHistory([]);
      return;
    }

    const pushEvent = (type: string, payload?: unknown) => {
      setEventHistory((prev) =>
        sliceEvents([
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            type,
            payload,
            timestamp: Date.now(),
          },
        ])
      );
    };

    const unsubscribe: Array<() => void> = [];

    unsubscribe.push(renderEvents.onRenderAll((payload) => pushEvent("render:all", payload)));
    unsubscribe.push(
      renderEvents.onRenderEntities((payload) => pushEvent("render:entities", payload))
    );
    unsubscribe.push(
      renderEvents.onViewportChanged((payload) => pushEvent("render:viewport", payload))
    );

    unsubscribe.push(
      entityEvents.added.addEventListener((entity) =>
        pushEvent("entity:added", summarizeEntity(entity))
      )
    );
    unsubscribe.push(
      entityEvents.removed.addEventListener((entity) =>
        pushEvent("entity:removed", summarizeEntity(entity))
      )
    );
    unsubscribe.push(
      entityEvents.updated.addEventListener((entity) =>
        pushEvent("entity:updated", summarizeEntity(entity))
      )
    );

    const detailedUnsub = entityEvents.updatedWithDetail.addEventListener((detail) =>
      pushEvent("entity:updated:detail", detail)
    );
    unsubscribe.push(detailedUnsub);

    return () => {
      unsubscribe.forEach((dispose) => dispose());
    };
  }, [entityEvents, renderEvents, eventTracking]);

  const groupedEntities = useMemo<EntityGroup[]>(() => {
    const counters = new Map<string, number>();
    entities.forEach((entity) => {
      counters.set(entity.type, (counters.get(entity.type) ?? 0) + 1);
    });
    return Array.from(counters.entries()).map(([type, count]) => ({
      type,
      count,
    }));
  }, [entities]);

  const runtimeTopology = computeManagerTopology(runtime);

  const flameGraphSegments = useMemo(
    () => extractFlameGraphSegments(renderStats.metrics),
    [renderStats]
  );

  const timeline = useMemo<EventTimeline>(() => {
    if (!eventTracking || eventHistory.length === 0) {
      return { events: [], span: 0, start: 0, end: 0 };
    }
    return buildEventTimeline(eventHistory, eventColorMapRef.current);
  }, [eventHistory, eventTracking]);

  const panelClasses = useMemo(() => {
    const classes = ["duck-debug-panel", `duck-debug-panel--${position}`];
    if (isOpen) {
      classes.push("duck-debug-panel--open");
    }
    return classes.join(" ");
  }, [isOpen, position]);

  const toggleLabel = isOpen ? "Close Debug" : "Open Debug";

  const metricGroups = useMemo(() => {
    const summary = renderStats.metricsSummary;
    return METRIC_GROUPS.map((group) => {
      const rawEntries = Object.entries(summary[group.key] ?? {});
      const entries = rawEntries
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
        .slice(0, group.maxItems ?? DEFAULT_METRIC_DISPLAY_LIMIT);
      return {
        key: group.key,
        label: group.label,
        entries,
      };
    });
  }, [renderStats.metricsSummary]);

  const hasMetricData = metricGroups.some((group) => group.entries.length > 0);
  const hasFlameGraphData = flameGraphSegments.length > 0;

  return (
    <>
      <button
        type="button"
        className={`duck-debug-panel__toggle duck-debug-panel__toggle--${position}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        title={toggleLabel}
      >
        🦆 Debug
      </button>
      <aside className={panelClasses} aria-hidden={!isOpen}>
        <header className="duck-debug-panel__header">
          <h2>KoduckFlow Debug</h2>
          <div className="duck-debug-panel__meta">
            <span>Runtime: {runtime.constructor.name}</span>
            <span>Entities: {entities.length}</span>
            <span>Queue: {renderQueue.length}</span>
          </div>
        </header>

        <section className="duck-debug-panel__section">
          <h3>Runtime Topology</h3>
          {runtimeTopology.length > 0 ? (
            <ul className="duck-debug-panel__topology">
              {runtimeTopology.map((node: ManagerTopologyNode) => (
                <li key={node.name} className="duck-debug-panel__topology-item">
                  <div
                    className={`duck-debug-panel__topology-row duck-debug-panel__topology-row--${node.status}`}
                  >
                    <div className="duck-debug-panel__topology-heading">
                      <span className="duck-debug-panel__topology-name">
                        {node.name}
                        {node.isCore && (
                          <span className="duck-debug-panel__topology-chip">core</span>
                        )}
                      </span>
                      <span className="duck-debug-panel__topology-type">{node.type}</span>
                    </div>
                    <div className="duck-debug-panel__topology-status">
                      <span
                        className={`duck-debug-panel__topology-status-pill duck-debug-panel__topology-status-pill--${node.status}`}
                      >
                        {formatManagerStatus(node.status)}
                      </span>
                      {node.path?.length ? (
                        <span
                          className="duck-debug-panel__topology-path"
                          title={`Initialization path: ${node.path.join(" → ")}`}
                        >
                          ↪ {node.path.join(" → ")}
                        </span>
                      ) : null}
                    </div>
                    {node.dependencies.length > 0 ? (
                      <div className="duck-debug-panel__topology-deps">
                        {node.dependencies.map((dep: string) => (
                          <span
                            key={`${node.name}-${dep}`}
                            className="duck-debug-panel__topology-chip"
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="duck-debug-panel__hint">No registered managers detected.</p>
          )}
        </section>

        <section className="duck-debug-panel__section">
          <h3>Entity Types</h3>
          <ul>
            {groupedEntities.map((group) => (
              <li key={group.type}>
                <span>{group.type}</span>
                <strong>{group.count}</strong>
              </li>
            ))}
            {groupedEntities.length === 0 && <li>Empty</li>}
          </ul>
        </section>

        <section className="duck-debug-panel__section">
          <h3>Render Queue</h3>
          <ul>
            {renderQueue.map((item) => (
              <li key={item.id}>
                <span>{item.id}</span>
                <strong>{item.type}</strong>
              </li>
            ))}
            {renderQueue.length === 0 && <li>No tracked entities</li>}
          </ul>
        </section>

        <section className="duck-debug-panel__section">
          <h3>Dirty Regions</h3>
          <div className="duck-debug-panel__grid">
            <span>Active regions</span>
            <strong>{dirtyRegions.length}</strong>
            <span>Dirty entities</span>
            <strong>{dirtyEntityIds.length}</strong>
            <span>Full redraw pending</span>
            <strong>{renderStats.pendingFullRedraw ? "Yes" : "No"}</strong>
          </div>
          <ul className="duck-debug-panel__regions">
            {dirtyRegions.slice(0, 6).map((region, index) => (
              <li key={`${region.x}-${region.y}-${index}`}>
                x:{region.x} y:{region.y} w:{region.width} h:{region.height}
              </li>
            ))}
            {dirtyRegions.length === 0 && <li>None</li>}
          </ul>
        </section>

        <section className="duck-debug-panel__section">
          <h3>Render Metrics</h3>
          {hasMetricData ? (
            metricGroups
              .filter((group) => group.entries.length > 0)
              .map((group) => (
                <div key={group.key} className="duck-debug-panel__metrics-group">
                  <h4>{group.label}</h4>
                  <div className="duck-debug-panel__grid">
                    {group.entries.map(([metric, value]) => (
                      <React.Fragment key={`${group.key}:${metric}`}>
                        <span>{metric}</span>
                        <strong>{value}</strong>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))
          ) : (
            <p className="duck-debug-panel__hint">No metrics recorded yet.</p>
          )}
        </section>

        <section className="duck-debug-panel__section">
          <h3>Render Flame Graph</h3>
          {hasFlameGraphData ? (
            <div
              className="duck-debug-panel__flame"
              role="list"
              aria-label="Render duration distribution"
            >
              {flameGraphSegments.map((segment: FlameGraphSegment) => (
                <div
                  key={segment.key}
                  role="listitem"
                  className="duck-debug-panel__flame-segment"
                  style={{
                    flexBasis: `${Math.max(segment.percent, 6)}%`,
                    flexGrow: Math.max(segment.percent, 1),
                  }}
                  title={`${segment.label} • total ${segment.total.toFixed(2)}ms across ${segment.count} samples`}
                >
                  <span>{segment.label}</span>
                  <small>{segment.average.toFixed(2)} ms avg</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="duck-debug-panel__hint">No render duration samples yet.</p>
          )}
        </section>

        <section className="duck-debug-panel__section">
          <h3>Event Timeline</h3>
          {eventTracking ? (
            <>
              {timeline.events.length > 0 ? (
                <div className="duck-debug-panel__timeline" aria-hidden={false}>
                  <div className="duck-debug-panel__timeline-axis" />
                  {timeline.events.map((event: TimelineEvent) => (
                    <span
                      key={`timeline-${event.id}`}
                      className="duck-debug-panel__timeline-event"
                      style={{ left: `${event.offset}%`, backgroundColor: event.color }}
                      title={`${event.type} • ${formatTime(event.timestamp)}`}
                    />
                  ))}
                  <div className="duck-debug-panel__timeline-labels">
                    <span>{formatTime(timeline.start)}</span>
                    <span>{formatTimelineWindow(timeline.span)}</span>
                    <span>{formatTime(timeline.end)}</span>
                  </div>
                </div>
              ) : (
                <p className="duck-debug-panel__hint">Waiting for events…</p>
              )}
              <ul className="duck-debug-panel__events">
                {eventHistory.length === 0 && <li>No events yet</li>}
                {eventHistory.map((event) => {
                  const color =
                    eventColorMapRef.current.get(event.type) ??
                    getOrAssignEventColor(event.type, eventColorMapRef.current);
                  return (
                    <li key={event.id} className="duck-debug-panel__event-item">
                      <div className="duck-debug-panel__event-header">
                        <span
                          className="duck-debug-panel__event-dot"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <span className="duck-debug-panel__event-time">
                          {formatTime(event.timestamp)}
                        </span>
                        <span className="duck-debug-panel__event-type">{event.type}</span>
                      </div>
                      {hasPayload(event.payload) && (
                        <pre className="duck-debug-panel__event-payload">
                          {formatPayload(event.payload)}
                        </pre>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="duck-debug-panel__hint">
              <span>
                Event tracking disabled. Pass <code>debugOptions.eventTracking</code> to enable.
              </span>
            </p>
          )}
        </section>
      </aside>
    </>
  );
};

function mapEntity(entity: IEntity): RenderQueueEntry {
  return { id: entity.id, type: entity.type };
}

function summarizeEntity(entity: IEntity) {
  return { id: entity.id, type: entity.type };
}

function hasPayload(payload: unknown): boolean {
  return payload !== null && payload !== undefined;
}

function formatPayload(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (typeof payload === "number" || typeof payload === "boolean") {
    return String(payload);
  }
  try {
    return JSON.stringify(payload, null, 2) ?? "null";
  } catch (error) {
    return `[unserializable payload: ${String(error)}]`;
  }
}

function computeManagerTopology(runtime: KoduckFlowRuntime): ManagerTopologyNode[] {
  const internal = runtime as unknown as {
    _managers?: Map<string, IManager>;
    _managerStates?: Map<string, { status: string; path?: string[] }>;
    _dependencies?: Map<string, string[]>;
  };

  const managerEntries = internal._managers ? Array.from(internal._managers.entries()) : [];
  const initialized = new Set(runtime.getInitializedManagers());
  const states = internal._managerStates ?? new Map<string, { status: string; path?: string[] }>();
  const dependencies = internal._dependencies ?? new Map<string, string[]>();

  const nodes: ManagerTopologyNode[] = managerEntries.map(([name, manager]) => {
    const state = states.get(name);
    const node: ManagerTopologyNode = {
      name,
      type: manager?.type ?? manager?.constructor?.name ?? "Manager",
      status: state?.status ?? (initialized.has(name) ? "ready" : "registered"),
      dependencies: dependencies.get(name) ?? [],
      isCore: RUNTIME_CORE_MANAGERS.has(name),
    };
    if (state?.path && state.path.length > 0) {
      node.path = [...state.path];
    }
    return node;
  });

  const registered = runtime.getRegisteredManagers();
  for (const name of registered) {
    if (nodes.some((node) => node.name === name)) {
      continue;
    }
    const state = states.get(name);
    const node: ManagerTopologyNode = {
      name,
      type: "Manager",
      status: state?.status ?? (initialized.has(name) ? "ready" : "registered"),
      dependencies: dependencies.get(name) ?? [],
      isCore: RUNTIME_CORE_MANAGERS.has(name),
    };
    if (state?.path && state.path.length > 0) {
      node.path = [...state.path];
    }
    nodes.push(node);
  }

  return nodes.sort((a, b) => {
    if (a.isCore && !b.isCore) return -1;
    if (!a.isCore && b.isCore) return 1;
    return a.name.localeCompare(b.name);
  });
}

function extractFlameGraphSegments(metrics?: MeterSnapshot): FlameGraphSegment[] {
  if (!metrics?.histograms?.length) {
    return [];
  }

  const durationHistogram = metrics.histograms.find(
    (metric) => metric.name === RENDER_DURATION_METRIC
  );
  if (!durationHistogram) {
    return [];
  }

  const segments = Object.entries(durationHistogram.points ?? {})
    .map(([key, point]) => histogramPointToSegment(key, point))
    .filter((segment) => segment.total > 0);

  if (segments.length === 0) {
    return [];
  }

  const totalDuration = segments.reduce((sum, segment) => sum + segment.total, 0);
  if (totalDuration <= 0) {
    return [];
  }

  return segments
    .sort((a, b) => b.total - a.total)
    .map((segment) => ({
      ...segment,
      percent: (segment.total / totalDuration) * 100,
    }));
}

function histogramPointToSegment(
  key: string,
  point: HistogramPoint
): Omit<FlameGraphSegment, "percent"> {
  const label = formatAttributesLabel(key);
  const total = point.sum;
  const count = point.count;

  return {
    key: key || "all",
    label,
    total,
    count,
    average: count > 0 ? total / count : 0,
  };
}

function formatAttributesLabel(key: string): string {
  const attrs = parseAttributeKey(key);
  const parts: string[] = [];

  if (attrs.renderer) {
    parts.push(`Renderer: ${attrs.renderer}`);
  }
  if (attrs.entityType) {
    parts.push(`Entity: ${attrs.entityType}`);
  }

  Object.entries(attrs)
    .filter(([attrKey]) => attrKey !== "renderer" && attrKey !== "entityType")
    .forEach(([attrKey, value]) => {
      parts.push(`${capitalize(attrKey)}: ${value}`);
    });

  if (parts.length === 0) {
    return "All renders";
  }

  return parts.join(" · ");
}

function parseAttributeKey(key: string): Record<string, string> {
  if (!key) {
    return {};
  }

  return key.split("|").reduce<Record<string, string>>((acc, entry) => {
    if (!entry) {
      return acc;
    }
    const [attrKey, ...rest] = entry.split("=");
    if (!attrKey) {
      return acc;
    }
    acc[attrKey] = rest.join("=");
    return acc;
  }, {});
}

function buildEventTimeline(
  events: DebugEventRecord[],
  colorRegistry: Map<string, string>
): EventTimeline {
  if (events.length === 0) {
    return { events: [], span: 0, start: 0, end: 0 };
  }

  const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const start = ordered[0].timestamp;
  const end = ordered[ordered.length - 1].timestamp;
  const span = Math.max(end - start, 1);

  const mapped = ordered.map((event) => ({
    ...event,
    offset: ((event.timestamp - start) / span) * 100,
    color: getOrAssignEventColor(event.type, colorRegistry),
  }));

  return {
    events: mapped,
    span,
    start,
    end,
  };
}

function formatManagerStatus(status: string): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "initializing":
      return "Initializing";
    case "failed":
      return "Failed";
    case "registered":
      return "Registered";
    default:
      return status ? capitalize(status) : "Unknown";
  }
}

function formatTimelineWindow(span: number): string {
  if (span <= 0) {
    return "–";
  }
  if (span >= 2000) {
    const seconds = span / 1000;
    return `${seconds.toFixed(seconds >= 10 ? 0 : 1)}s window`;
  }
  if (span >= 1000) {
    return `${(span / 1000).toFixed(2)}s window`;
  }
  return `${span}ms window`;
}

function getOrAssignEventColor(type: string, registry: Map<string, string>): string {
  const existing = registry.get(type);
  if (existing) {
    return existing;
  }
  const color = EVENT_COLOR_PALETTE[registry.size % EVENT_COLOR_PALETTE.length];
  registry.set(type, color);
  return color;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default DebugPanel;
