/**
 * @file Browser-compatible EventEmitter implementation
 * @module common/event/browser-event-emitter
 *
 * A lightweight EventEmitter that works in both browser and Node.js environments.
 * Replaces `node:events` for browser compatibility while maintaining API parity
 * with the subset of methods used in the worker-pool module.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

/**
 * Browser-compatible EventEmitter implementation
 *
 * Provides the core EventEmitter API (on, off, once, emit, removeAllListeners)
 * without depending on Node.js built-in modules.
 *
 * @example
 * ```typescript
 * import { BrowserEventEmitter } from './browser-event-emitter';
 *
 * class MyClass extends BrowserEventEmitter {
 *   doSomething() {
 *     this.emit('event', { data: 'value' });
 *   }
 * }
 *
 * const instance = new MyClass();
 * instance.on('event', (payload) => console.log(payload));
 * ```
 */
export class BrowserEventEmitter {
  private readonly _events: Map<string | symbol, Set<Listener>> = new Map();
  private _maxListeners: number = 10;

  /**
   * Adds a listener for the specified event
   *
   * @param event - Event name
   * @param listener - Callback function
   * @returns this (for chaining)
   */
  on(event: string | symbol, listener: Listener): this {
    const listeners = this._events.get(event);
    if (listeners) {
      listeners.add(listener);
    } else {
      this._events.set(event, new Set([listener]));
    }
    return this;
  }

  /**
   * Alias for `on`
   *
   * @param event - Event name
   * @param listener - Callback function
   * @returns this (for chaining)
   */
  addListener(event: string | symbol, listener: Listener): this {
    return this.on(event, listener);
  }

  /**
   * Adds a one-time listener for the specified event
   *
   * @param event - Event name
   * @param listener - Callback function (called once then removed)
   * @returns this (for chaining)
   */
  once(event: string | symbol, listener: Listener): this {
    const onceWrapper: Listener = (...args) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    // Store reference to original listener for removal
    (onceWrapper as { _originalListener?: Listener })._originalListener = listener;
    return this.on(event, onceWrapper);
  }

  /**
   * Removes a listener for the specified event
   *
   * @param event - Event name
   * @param listener - Callback function to remove
   * @returns this (for chaining)
   */
  off(event: string | symbol, listener: Listener): this {
    const listeners = this._events.get(event);
    if (!listeners) {
      return this;
    }

    // Check for direct match
    if (listeners.has(listener)) {
      listeners.delete(listener);
    } else {
      // Check for once wrapper match
      for (const fn of listeners) {
        if ((fn as { _originalListener?: Listener })._originalListener === listener) {
          listeners.delete(fn);
          break;
        }
      }
    }

    if (listeners.size === 0) {
      this._events.delete(event);
    }
    return this;
  }

  /**
   * Alias for `off`
   *
   * @param event - Event name
   * @param listener - Callback function to remove
   * @returns this (for chaining)
   */
  removeListener(event: string | symbol, listener: Listener): this {
    return this.off(event, listener);
  }

  /**
   * Emits an event with the provided arguments
   *
   * @param event - Event name
   * @param args - Arguments to pass to listeners
   * @returns true if the event had listeners, false otherwise
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(event: string | symbol, ...args: any[]): boolean {
    const listeners = this._events.get(event);
    if (!listeners || listeners.size === 0) {
      return false;
    }

    // Iterate over listeners (copy not needed as Set iteration is safe)
    for (const listener of listeners) {
      try {
        listener.apply(this, args);
      } catch (err) {
        // Emit error event or log
        if (event === "error") {
          console.error("EventEmitter error:", err);
        } else {
          this.emit("error", err);
        }
      }
    }
    return true;
  }

  /**
   * Removes all listeners for the specified event, or all events if none specified
   *
   * @param event - Optional event name
   * @returns this (for chaining)
   */
  removeAllListeners(event?: string | symbol): this {
    if (event === undefined) {
      this._events.clear();
    } else {
      this._events.delete(event);
    }
    return this;
  }

  /**
   * Returns the number of listeners for the specified event
   *
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: string | symbol): number {
    const listeners = this._events.get(event);
    return listeners ? listeners.size : 0;
  }

  /**
   * Returns an array of listeners for the specified event
   *
   * @param event - Event name
   * @returns Array of listener functions
   */
  listeners(event: string | symbol): Listener[] {
    const listeners = this._events.get(event);
    return listeners ? [...listeners] : [];
  }

  /**
   * Returns an array of event names with registered listeners
   *
   * @returns Array of event names
   */
  eventNames(): (string | symbol)[] {
    return [...this._events.keys()];
  }

  /**
   * Sets the maximum number of listeners (for compatibility, not enforced)
   *
   * @param n - Maximum listeners count
   * @returns this (for chaining)
   */
  setMaxListeners(n: number): this {
    this._maxListeners = n;
    return this;
  }

  /**
   * Gets the maximum number of listeners
   *
   * @returns Maximum listeners count
   */
  getMaxListeners(): number {
    return this._maxListeners;
  }
}

/**
 * Default export for drop-in replacement of node:events EventEmitter
 */
export { BrowserEventEmitter as EventEmitter };
