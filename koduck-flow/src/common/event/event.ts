/**
 * @module src/common/event/event
 * @description Event system barrel module. Exports types, configurations, and implementations
 * for event handling and emitting across the application
 */

// Barrel module to preserve previous import path and exports
export type { IEvent, IEventListener, EventConfiguration } from "./types";
export { EventPreset, EVENT_PRESETS, EventConfigValidator } from "./config";
export { BaseEvent } from "./base-event";
export { GenericEvent, createEmitter } from "./generic-event";
