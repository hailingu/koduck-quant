/**
 * Configuration Event Emitter Implementation
 *
 * Lightweight event emitter for configuration reload events
 */

import type {
  IConfigEventEmitter,
  ConfigEventListener,
  ConfigReloadEvent,
} from "./types/config-event.interface";

/**
 * Simple event emitter for configuration events
 */
export class ConfigEventEmitter implements IConfigEventEmitter {
  private readonly listeners: ConfigEventListener[] = [];

  on(_event: "reload", listener: ConfigEventListener): void {
    if (!this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
  }

  off(_event: "reload", listener: ConfigEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  emit(_event: "reload", data: ConfigReloadEvent): void {
    // Call listeners synchronously to maintain reload order
    for (const listener of this.listeners) {
      listener(data);
    }
  }
}

/**
 * Global configuration event emitter instance
 */
export const configEventEmitter = new ConfigEventEmitter();
