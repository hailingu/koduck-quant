import type { RenderEventManager, RenderEntitiesEvent } from "../../event";
import type { IEntity } from "../../entity";

type RemoveEntityOptions = {
  markDirty?: boolean;
  schedule?: boolean;
};

type DetachErrorHandler = (error: unknown) => void;

type MarkEntityDirtyById = (entityId: string, reason: string) => boolean;
type TrackEntityForPartialUpdate = (entity: IEntity, reason: string) => boolean;
type RemoveEntityFromRender = (entityId: string, options?: RemoveEntityOptions) => void;
type RequestFullRedraw = (reason: string) => void;
type ScheduleDirtyFlush = () => void;
type GetTrackedEntity = (entityId: string) => IEntity | undefined;

type BridgeStateCallback = () => void;

export interface RenderEventBridgeOptions {
  renderEvents: RenderEventManager;
  getTrackedEntity: GetTrackedEntity;
  markEntityDirtyById: MarkEntityDirtyById;
  trackEntityForPartialUpdate: TrackEntityForPartialUpdate;
  removeEntityFromRender: RemoveEntityFromRender;
  requestFullRedraw: RequestFullRedraw;
  scheduleDirtyFlush: ScheduleDirtyFlush;
  onAttach?: BridgeStateCallback;
  onDetach?: BridgeStateCallback;
  onDetachError?: DetachErrorHandler;
}

export class RenderEventBridge {
  private readonly options: RenderEventBridgeOptions;
  private unsubscribeFns: Array<() => void> = [];
  private attached = false;

  constructor(options: RenderEventBridgeOptions) {
    this.options = options;
  }

  attach(): boolean {
    if (this.attached) {
      return false;
    }

    const { renderEvents } = this.options;

    const unsubscribeAll = renderEvents.onRenderAll(() => {
      this.options.requestFullRedraw("render_all_event");
    });

    const unsubscribeEntities = renderEvents.onRenderEntities((payload) => {
      this.handleRenderEntities(payload);
    });

    const unsubscribeViewport = renderEvents.onViewportChanged(() => {
      this.options.requestFullRedraw("viewport_changed");
    });

    this.unsubscribeFns = [unsubscribeAll, unsubscribeEntities, unsubscribeViewport];
    this.attached = true;
    this.options.onAttach?.();
    return true;
  }

  detach(): boolean {
    if (!this.attached) {
      return false;
    }

    this.attached = false;
    const callbacks = this.unsubscribeFns.splice(0);
    for (const unsubscribe of callbacks) {
      try {
        unsubscribe();
      } catch (error) {
        this.options.onDetachError?.(error);
      }
    }
    this.options.onDetach?.();
    return true;
  }

  private handleRenderEntities(payload: RenderEntitiesEvent): void {
    const op = payload.op ?? "render";
    let fallback = false;
    let anyDirty = false;

    if (op === "remove") {
      for (const entityId of payload.entityIds) {
        const entity = this.options.getTrackedEntity(entityId);
        if (entity) {
          if (this.options.trackEntityForPartialUpdate(entity, "event_remove")) {
            anyDirty = true;
          } else {
            fallback = true;
          }
        } else {
          fallback = true;
        }
        this.options.removeEntityFromRender(entityId, { markDirty: false });
      }
    } else {
      for (const entityId of payload.entityIds) {
        if (this.options.markEntityDirtyById(entityId, "event_render")) {
          anyDirty = true;
        } else {
          fallback = true;
        }
      }
    }

    if (fallback) {
      this.options.requestFullRedraw("render_entities_event");
      return;
    }

    if (anyDirty) {
      this.options.scheduleDirtyFlush();
    }
  }
}
