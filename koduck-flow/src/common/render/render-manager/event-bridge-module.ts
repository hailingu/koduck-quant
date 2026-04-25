import { diagnostics } from "../render-diagnostics";
import type { RenderEventManager } from "../../event";
import type { IEntity } from "../../entity";
import type { RenderMetricsModule } from "./render-metrics-module";
import { RenderEventBridge } from "./render-event-bridge";

export interface EventBridgeModuleDependencies {
  renderEvents: RenderEventManager;
  metrics: RenderMetricsModule;
  getTrackedEntity: (entityId: string) => IEntity | undefined;
  markEntityDirtyById: (entityId: string, reason: string) => boolean;
  trackEntityForPartialUpdate: (entity: IEntity, reason: string) => boolean;
  removeEntityFromRender: (
    entityId: string,
    options?: { markDirty?: boolean; schedule?: boolean }
  ) => void;
  requestFullRedraw: (reason: string) => void;
  scheduleDirtyFlush: () => void;
}

export class EventBridgeModule {
  private readonly bridge: RenderEventBridge;
  private readonly metrics: RenderMetricsModule;

  constructor(options: EventBridgeModuleDependencies) {
    this.metrics = options.metrics;

    this.bridge = new RenderEventBridge({
      renderEvents: options.renderEvents,
      getTrackedEntity: options.getTrackedEntity,
      markEntityDirtyById: options.markEntityDirtyById,
      trackEntityForPartialUpdate: options.trackEntityForPartialUpdate,
      removeEntityFromRender: options.removeEntityFromRender,
      requestFullRedraw: options.requestFullRedraw,
      scheduleDirtyFlush: options.scheduleDirtyFlush,
      onAttach: () => {
        this.metrics.recordEventBridge("attach");
        diagnostics.info("Render event bridge attached");
      },
      onDetach: () => {
        this.metrics.recordEventBridge("detach");
        diagnostics.info("Render event bridge detached");
      },
      onDetachError: (error) => {
        this.metrics.recordEventBridge("detach_error");
        this.metrics.recordError("event_bridge_detach");
        diagnostics.warn("Failed to detach render event bridge", error);
      },
    });
  }

  attach(): void {
    this.bridge.attach();
  }

  detach(): void {
    this.bridge.detach();
  }
}
