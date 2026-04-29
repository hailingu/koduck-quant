/**
 * Koduck Flow Event System Unified Exports
 *
 * Provides a unified entry point for all event system components
 */

// Core event infrastructure
export { BaseEvent, GenericEvent, createEmitter } from "./event";
export type { IEvent, IEventListener, EventConfiguration } from "./types";

// Event manager modules
export { BatchManager } from "./batch-manager";
export { DedupeManager } from "./dedupe-manager";
export { SchedulerManager } from "./scheduler-manager";
export { ErrorReporter } from "./error-reporter";
export { MetricsCollector } from "./metrics-collector";

// Entity events
export {
  EntityEvent,
  EntityAddEvent,
  EntityRemoveEvent,
  EntityUpdateEvent,
  EntityEventType,
  type EntityEventTypeValue,
} from "./entity-event";

// Event managers
export { EventManager } from "./event-manager";
export { EntityEventManager, createEntityEventManager } from "./entity-event-manager";

// System event bus
export {
  EventBus,
  LoggingEvent,
  SystemEventBus,
  type LogEvent,
  type SystemEvent,
  createEventBus,
} from "./event-bus";

// Render event manager (Option 1)
export {
  RenderEventManager,
  type RenderAllEvent,
  type RenderEntitiesEvent,
  createRenderEventManager,
} from "./render-event-manager";

// Listener snapshot pool
export { ListenerSnapshotPool, defaultListenerSnapshotPool } from "./listener-snapshot-pool";
export type { IListenerSnapshotPool } from "./types";
