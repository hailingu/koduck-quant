import type { EventConfiguration } from "./types";
import { BaseEvent } from "./base-event";
import type { EventPreset } from "./config";

/**
 * Generic event class
 *
 * Concrete implementation of BaseEvent, can be used to create simple events of any type.
 * Replaces Emitter class functionality, providing the same convenient API while enjoying all BaseEvent optimizations.
 */
export class GenericEvent<T> extends BaseEvent<T> {
  constructor(
    eventName: string = "GenericEvent",
    configOrPreset?: Partial<EventConfiguration> | EventPreset
  ) {
    super(eventName, configOrPreset);
  }
}

/**
 * Factory function for creating event emitters
 *
 * Replaces the usage of new Emitter<T>(), providing the same convenient API.
 * Internally uses BaseEvent implementation, enjoying all features such as batching and performance optimization.
 */
export function createEmitter<T>(
  eventName?: string,
  configOrPreset?: Partial<EventConfiguration> | EventPreset
): BaseEvent<T> {
  return new GenericEvent<T>(eventName, configOrPreset);
}
