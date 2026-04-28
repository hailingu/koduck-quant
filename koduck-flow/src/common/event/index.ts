/**
 * Koduck Flow 事件系统统一导出
 *
 * 提供事件系统所有组件的统一入口点
 */

// 核心事件基础设施
export { BaseEvent, GenericEvent, createEmitter } from "./event";
export type { IEvent, IEventListener, EventConfiguration } from "./types";

// 事件管理器模块
export { BatchManager } from "./batch-manager";
export { DedupeManager } from "./dedupe-manager";
export { SchedulerManager } from "./scheduler-manager";
export { ErrorReporter } from "./error-reporter";
export { MetricsCollector } from "./metrics-collector";

// 实体事件
export {
  EntityEvent,
  EntityAddEvent,
  EntityRemoveEvent,
  EntityUpdateEvent,
  EntityEventType,
  type EntityEventTypeValue,
} from "./entity-event";

// 事件管理器
export { EventManager } from "./event-manager";
export { EntityEventManager, createEntityEventManager } from "./entity-event-manager";

// 系统事件总线
export {
  EventBus,
  LoggingEvent,
  SystemEventBus,
  type LogEvent,
  type SystemEvent,
  createEventBus,
} from "./event-bus";

// 渲染事件管理器（方案1）
export {
  RenderEventManager,
  type RenderAllEvent,
  type RenderEntitiesEvent,
  createRenderEventManager,
} from "./render-event-manager";

// 监听器快照对象池
export { ListenerSnapshotPool, defaultListenerSnapshotPool } from "./listener-snapshot-pool";
export type { IListenerSnapshotPool } from "./types";
