import type { RenderEventManager } from "../../event";
import type { RegistryManager } from "../../registry";
import type { EntityManager } from "../../entity";
import type { MeterSnapshot } from "../../metrics";
import type { RenderFrameScheduler } from "./render-frame-scheduler";

export type RenderMetricSummary = {
  lifecycle: Record<string, number>;
  connections: Record<string, number>;
  context: Record<string, number>;
  redrawScheduled: Record<string, number>;
  redrawRequested: Record<string, number>;
  redrawReasons: Record<string, number>;
  eventBridge: Record<string, number>;
  errors: Record<string, number>;
  dirtyFallbacks: Record<string, number>;
  schedulerBackpressure: Record<string, number>;
};

export interface RenderManagerDependencies {
  renderEvents: RenderEventManager;
  registryManager?: RegistryManager;
  entityManager?: EntityManager;
  frameScheduler?: RenderFrameScheduler;
}

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DirtyRegion = Bounds;

export type RenderStats = {
  queueSize: number;
  dirtyRegionCount: number;
  dirtyEntityCount: number;
  pendingFullRedraw: boolean;
  metricsSummary: RenderMetricSummary;
  metrics?: MeterSnapshot | undefined;
};
