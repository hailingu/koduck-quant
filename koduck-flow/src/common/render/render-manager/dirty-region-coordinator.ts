import { logger } from "../../logger";
import { diagnostics } from "../render-diagnostics";
import type { IEntity } from "../../entity";
import { DirtyRegionManager } from "./dirty-region-manager";
import type { DirtyRegionManagerArtifacts } from "./dirty-region-manager";
import { RenderFrameScheduler } from "./render-frame-scheduler";
import type { RenderMetricsModule } from "./render-metrics-module";
import type {
  IDirtyRegionCoordinator,
  IEntityLifecycleTracker,
  RenderCanvasArtifacts,
} from "./contracts";

const dirtyRegionLogger = logger.withContext({
  tag: "render-manager:dirty",
  metadata: {
    component: "RenderManager",
    module: "DirtyRegionCoordinator",
  },
});

export interface DirtyRegionCoordinatorOptions {
  metrics: RenderMetricsModule;
  onFullRedraw: (reason: string) => void;
  onPartialFlush: () => void;
  frameScheduler?: RenderFrameScheduler;
  maxDirtyRegions?: number;
  dirtyRegionPadding?: number;
  canvasArtifactsProvider?: () => RenderCanvasArtifacts;
  trackedEntitiesProvider?: () => Iterable<IEntity>;
}

export class DirtyRegionCoordinator implements IDirtyRegionCoordinator {
  private readonly frameScheduler: RenderFrameScheduler;
  private readonly metrics: RenderMetricsModule;
  private readonly manager: DirtyRegionManager;
  private canvasArtifactsProvider: () => RenderCanvasArtifacts;
  private entityTracker: IEntityLifecycleTracker | undefined;
  private renderExecutor: () => void = () => {};
  private onEntityUpdate: (() => void) | undefined;

  constructor(options: DirtyRegionCoordinatorOptions) {
    this.metrics = options.metrics;
    this.frameScheduler = options.frameScheduler ?? new RenderFrameScheduler();
    this.canvasArtifactsProvider =
      options.canvasArtifactsProvider ??
      (() => ({ renderer: undefined, context: undefined, canvas: undefined, c2d: undefined }));

    this.manager = new DirtyRegionManager({
      frameScheduler: this.frameScheduler,
      diagnostics,
      logger: dirtyRegionLogger,
      metrics: this.metrics.meter,
      getCanvasArtifacts: () =>
        this.canvasArtifactsProvider() as unknown as DirtyRegionManagerArtifacts,
      getTrackedEntities: () =>
        this.entityTracker?.getEntities() ?? options.trackedEntitiesProvider?.() ?? [],
      onFullRedrawRequired: (reason) => options.onFullRedraw(reason),
      onPartialFlush: () => options.onPartialFlush(),
      ...(options.maxDirtyRegions !== undefined
        ? { maxDirtyRegions: options.maxDirtyRegions }
        : {}),
      ...(options.dirtyRegionPadding !== undefined
        ? { dirtyRegionPadding: options.dirtyRegionPadding }
        : {}),
    });
  }

  attachCanvasArtifactsProvider(provider: () => RenderCanvasArtifacts): void {
    this.canvasArtifactsProvider = provider;
  }

  attachEntityTracker(tracker: IEntityLifecycleTracker): void {
    this.entityTracker = tracker;
  }

  setRenderExecutor(executor: () => void, onEntityUpdate?: () => void): void {
    this.renderExecutor = executor;
    this.onEntityUpdate = onEntityUpdate;
  }

  scheduleRedraw(trigger?: string): void {
    const normalizedTrigger = trigger || "unknown";
    const scheduled = this.frameScheduler.scheduleRedraw(
      () => {
        try {
          this.manager.resetForFullRedraw();
          this.renderExecutor();
          this.onEntityUpdate?.();
        } catch (error) {
          this.metrics.recordError("entity_update_callback");
          diagnostics.error("Entity update callback failed during redraw", {
            trigger: normalizedTrigger,
            error,
          });
        }
      },
      {
        label: `full_redraw:${normalizedTrigger}`,
        priority: "critical",
        allowBudgetBypass: true,
        estimatedDurationMs: 8,
      }
    );

    this.metrics.recordRedrawScheduled("full", normalizedTrigger);

    if (scheduled) {
      this.manager.resetForFullRedraw();
      diagnostics.debug("Full redraw scheduled", {
        trigger: normalizedTrigger,
      });
    } else {
      diagnostics.debug("Redraw request coalesced with pending frame", {
        trigger: normalizedTrigger,
      });
    }
  }

  requestFullRedraw(reason: string): void {
    this.manager.requestFullRedraw(reason);
    const normalizedReason = reason || "unknown";
    this.metrics.recordFullRedrawRequest(normalizedReason);

    const fallbackIndicators = ["dirty", "missing", "no_", "error", "fallback"];
    if (fallbackIndicators.some((token) => normalizedReason.includes(token))) {
      this.metrics.recordDirtyFallback("full_redraw_request", normalizedReason);
    }

    diagnostics.info("Full redraw requested", { reason: normalizedReason });
  }

  markEntityDirty(entity: IEntity, reason: string): boolean {
    return this.manager.markEntityDirty(entity, reason);
  }

  markEntityDirtyById(entityId: string, reason: string): boolean {
    const tracker = this.entityTracker;
    if (!tracker) {
      this.metrics.recordDirtyFallback("missing_tracker", reason);
      this.requestFullRedraw(`${reason}:missing_tracker`);
      return false;
    }

    const marked = tracker.markEntityDirtyById(entityId, reason);
    if (!marked) {
      this.metrics.recordDirtyFallback("mark_entity_dirty", reason);
    }
    return marked;
  }

  getDirtyRegions() {
    return this.manager.getDirtyRegionsSnapshot();
  }

  getDirtyEntityIds(): string[] {
    return Array.from(this.manager.getDirtyEntityIds());
  }

  isFullRedrawPending(): boolean {
    return this.frameScheduler.isFullRedrawPending();
  }

  setFullRedrawPending(value: boolean): void {
    this.frameScheduler.setFullRedrawPending(value);
  }

  scheduleDirtyFlush(): void {
    this.manager.schedulePartialFlush();
  }

  /**
   * Exposed for modules that still require direct manager access.
   */
  getManager(): DirtyRegionManager {
    return this.manager;
  }
}
