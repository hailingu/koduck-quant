import { ErrorCode, ErrorSeverity, logError } from "../errors";
import type { IEvent, IEventListener, EventConfiguration, IListenerSnapshotPool } from "./types";
import { EventConfigValidator, EVENT_PRESETS, EventPreset } from "./config";
import { BatchManager } from "./batch-manager";
import { DedupeManager } from "./dedupe-manager";
import { SchedulerManager } from "./scheduler-manager";
import { MetricsCollector } from "./metrics-collector";
import { ErrorReporter } from "./error-reporter";
import { defaultListenerSnapshotPool } from "./listener-snapshot-pool";

type ConcurrencyMode = EventConfiguration["concurrencyMode"];

type AsyncDispatchOutcome = {
  errorCount: number;
  firstError: unknown;
  timeoutWarnCount: number;
  timeoutMs?: number;
};

/**
 * Event base class supporting batching, async operations, and error handling
 *
 * @template T Event data type
 * @abstract
 * @since 1.0.0
 */
export abstract class BaseEvent<T> {
  /** Event listener array */
  protected _listeners: IEventListener<T>[] = [];

  /** Event listener set for O(1) lookup */
  private readonly _listenerSet = new Set<IEventListener<T>>();

  /** Event name identifier */
  protected readonly eventName: string;

  /** Event fire count */
  private _fireCount: number = 0;

  /** Debug mode flag */
  private _debugMode: boolean = false;

  /** Event configuration */
  private _config: Readonly<EventConfiguration>;

  /** Data validator (lightweight - only activated in debug mode) */
  private _dataValidator: ((data: T) => boolean) | undefined;

  // ===== Manager instances =====
  private readonly _batchManager: BatchManager<T>;
  private readonly _dedupeManager: DedupeManager<T>;
  private readonly _schedulerManager: SchedulerManager;
  private readonly _errorReporter: ErrorReporter;
  private readonly _metricsCollector: MetricsCollector;
  private readonly _listenerSnapshotPool: IListenerSnapshotPool;

  constructor(
    eventName: string,
    configOrPreset?: Partial<EventConfiguration> | EventPreset,
    listenerSnapshotPool?: IListenerSnapshotPool
  ) {
    this.eventName = eventName;

    // Supports preset config or custom config
    if (typeof configOrPreset === "string") {
      this._config = Object.freeze({ ...EVENT_PRESETS[configOrPreset] });
    } else {
      this._config = Object.freeze(EventConfigValidator.validate(configOrPreset || {}));
    }

    // Initialize debug mode based on config
    this._debugMode = this._config.enableDebugMode;

    // Initialize listener snapshot pool (using dependency injection, defaults to global instance)
    this._listenerSnapshotPool = listenerSnapshotPool || defaultListenerSnapshotPool;

    // Initialize various managers
    this._batchManager = new BatchManager<T>(this._config);
    this._dedupeManager = new DedupeManager<T>(eventName, this._config);
    this._schedulerManager = new SchedulerManager(this._config);
    this._errorReporter = new ErrorReporter(eventName, this._config);
    this._metricsCollector = new MetricsCollector(eventName, () => this._batchManager.batchCount);
  }

  /**
   * Gets event register (implements IEvent interface)
   * @returns Event registration function
   */
  get event(): IEvent<T> {
    return (listener: IEventListener<T>): (() => void) => {
      return this.addEventListener(listener);
    };
  }

  /** Add event listener */
  addEventListener(listener: IEventListener<T>): () => void {
    if (!listener || typeof listener !== "function") {
      logError(
        ErrorCode.EVENT_LISTENER_ERROR,
        `Invalid listener provided to event "${this.eventName}"`,
        {
          severity: ErrorSeverity.WARNING,
          context: {
            eventName: this.eventName,
            listenerType: typeof listener,
            currentListenerCount: this._listeners.length,
          },
        }
      );
      // Return empty cancel function
      return () => {};
    }

    // Check listener count limit
    if (this._listeners.length >= this._config.maxListeners) {
      logError(
        ErrorCode.EVENT_LISTENER_ERROR,
        `Maximum number of listeners (${this._config.maxListeners}) exceeded for event "${this.eventName}"`,
        {
          severity: ErrorSeverity.ERROR,
          context: {
            eventName: this.eventName,
            currentListenerCount: this._listeners.length,
            maxListeners: this._config.maxListeners,
          },
        }
      );
      // Return empty cancel function
      return () => {};
    }

    // Allow same listener to be registered multiple times
    this._listeners.push(listener);
    this._listenerSet.add(listener);

    // Update metrics
    this._metricsCollector.updateActiveListeners(this._listeners.length);

    // Return unregister function
    return () => {
      const index = this._listeners.indexOf(listener);
      if (index > -1) {
        this._listeners.splice(index, 1);
        // Only remove from Set if no other identical listener exists
        if (!this._listeners.includes(listener)) {
          this._listenerSet.delete(listener);
        }
        this._metricsCollector.updateActiveListeners(this._listeners.length);
      }
    };
  }

  /** Remove event listener */
  removeEventListener(listener: IEventListener<T>): boolean {
    if (!this._listenerSet.has(listener)) {
      return false;
    }

    const index = this._listeners.indexOf(listener);
    if (index > -1) {
      this._listeners.splice(index, 1);
      // Only remove from Set when the listener is no longer in the array
      if (!this._listeners.includes(listener)) {
        this._listenerSet.delete(listener);
      }
      this._metricsCollector.updateActiveListeners(this._listeners.length);
      return true;
    }
    return false;
  }

  /** Batch register listeners, supports chaining */
  addListeners(...listeners: IEventListener<T>[]): this {
    listeners.forEach((listener) => this.addEventListener(listener));
    return this;
  }

  /** One-time listener - auto-removes after first trigger */
  once(listener: IEventListener<T>): this {
    const onceListener: IEventListener<T> = (data) => {
      try {
        listener(data);
      } finally {
        this.removeEventListener(onceListener);
      }
    };
    this.addEventListener(onceListener);
    return this;
  }

  /** Conditional listener - only triggers when condition is met */
  when(condition: (data: T) => boolean, listener: IEventListener<T>): this {
    const conditionalListener: IEventListener<T> = (data) => {
      if (condition(data)) listener(data);
    };
    this.addEventListener(conditionalListener);
    return this;
  }

  /** Fire event (smart batching selection) */
  fire(eventData: T): void {
    // Optional: payload deduplication (sync path)
    if (this._dedupeManager.shouldDropByDedupe(eventData)) return;

    // Lightweight validation - only executed in debug mode
    if (this._dataValidator && this._debugMode && !this._dataValidator(eventData)) {
      this._errorReporter.reportValidationFailure();
      return;
    }

    const shouldUseBatch = this._batchManager.shouldUseBatchProcessing(this._listeners.length);

    if (shouldUseBatch) {
      this._batchManager.addToBatch(eventData, (data) => {
        this._fireImmediate(data);
      });
    } else {
      this._fireImmediate(eventData);
    }
  }

  /** Fire event immediately (without batching) */
  private _fireImmediate(eventData: T): void {
    this._fireCount++;

    // Record metrics
    this._metricsCollector.recordEmitted("sync");

    if (this._listeners.length === 0) {
      return;
    }

    // Use snapshot to avoid structural changes to listener array during iteration
    const listeners = this._listenerSnapshotPool.borrowSnapshot(this._listeners);
    const listenerCount = listeners.length;

    // Record listener invocations
    this._metricsCollector.recordListenersInvoked(listenerCount, "sync");

    let errorCount = 0;
    const errors: Array<{ index: number; error: unknown }> = [];

    const t0 = Date.now();

    try {
      for (let i = 0; i < listenerCount; i++) {
        try {
          listeners[i](eventData);
        } catch (error) {
          errorCount++;
          // Collect detailed error information
          if (errorCount <= 3) {
            errors.push({ index: i, error });
          }
        }
      }
    } finally {
      this._listenerSnapshotPool.releaseSnapshot(listeners);
    }

    // Record dispatch duration and errors
    const dt = Date.now() - t0;
    this._metricsCollector.recordDispatchDuration(dt, "sync");
    this._metricsCollector.recordListenerErrors(errorCount, "sync");

    // Unified error reporting
    if (errorCount > 0) {
      this._errorReporter.reportErrors(errors);
    }
  }

  /** Fire event asynchronously */
  async fireAsync(eventData: T): Promise<void> {
    // Optional: payload deduplication (async path)
    if (this._dedupeManager.shouldDropByDedupe(eventData)) return;

    this._fireCount++;
    this._metricsCollector.recordEmitted("async");

    if (this._listeners.length === 0) {
      return;
    }

    // Use snapshot to avoid structural changes during iteration
    const listeners = this._listenerSnapshotPool.borrowSnapshot(this._listeners);
    const listenerCount = listeners.length;
    this._metricsCollector.recordListenersInvoked(listenerCount, "async");

    const t0 = Date.now();

    const mode = this._config.concurrencyMode;
    const limit = Math.max(1, this._config.concurrencyLimit || 1);

    let outcome: AsyncDispatchOutcome;
    try {
      if (mode === "parallel") {
        outcome = await this._dispatchAsyncParallel(listeners, eventData, mode);
      } else if (mode === "limited") {
        outcome = await this._dispatchAsyncLimited(listeners, eventData, mode, limit);
      } else {
        outcome = await this._dispatchAsyncSeries(listeners, eventData, mode);
      }
    } finally {
      this._listenerSnapshotPool.releaseSnapshot(listeners);
    }

    // Summary alerts (rate-limiting mode)
    if (
      mode === "limited" &&
      this._debugMode &&
      outcome.timeoutWarnCount > 3 &&
      typeof outcome.timeoutMs === "number"
    ) {
      this._errorReporter.reportBatchTimeoutWarning(
        outcome.timeoutWarnCount,
        outcome.timeoutMs,
        mode
      );
    }

    // Simplified error reporting
    if (outcome.errorCount > 0 && this._debugMode) {
      if (outcome.errorCount > 3) {
        // Report simplified error information via error reporter
      }
    }

    // Record dispatch duration and errors (async)
    const dt = Date.now() - t0;
    this._metricsCollector.recordDispatchDuration(dt, "async");
    this._metricsCollector.recordListenerErrors(outcome.errorCount, "async");
  }

  private _createAsyncOutcome(): AsyncDispatchOutcome {
    return {
      errorCount: 0,
      firstError: null,
      timeoutWarnCount: 0,
    };
  }

  private _recordAsyncError(
    outcome: AsyncDispatchOutcome,
    index: number,
    error: unknown,
    mode: ConcurrencyMode
  ): void {
    outcome.errorCount++;
    if (!outcome.firstError) {
      outcome.firstError = error;
    }
    if (outcome.errorCount <= 3) {
      this._errorReporter.reportAsyncWarning(index, error, mode);
    }
  }

  private async _dispatchAsyncParallel(
    listeners: IEventListener<T>[],
    eventData: T,
    mode: ConcurrencyMode
  ): Promise<AsyncDispatchOutcome> {
    const outcome = this._createAsyncOutcome();
    await Promise.all(
      listeners.map(async (fn, index) => {
        try {
          await Promise.resolve(fn(eventData));
        } catch (error) {
          this._recordAsyncError(outcome, index, error, mode);
        }
      })
    );
    return outcome;
  }

  private async _dispatchAsyncSeries(
    listeners: IEventListener<T>[],
    eventData: T,
    mode: ConcurrencyMode
  ): Promise<AsyncDispatchOutcome> {
    const outcome = this._createAsyncOutcome();
    for (let i = 0; i < listeners.length; i++) {
      try {
        await Promise.resolve(listeners[i](eventData));
      } catch (error) {
        this._recordAsyncError(outcome, i, error, mode);
      }
    }
    return outcome;
  }

  private async _dispatchAsyncLimited(
    listeners: IEventListener<T>[],
    eventData: T,
    mode: ConcurrencyMode,
    limit: number
  ): Promise<AsyncDispatchOutcome> {
    const outcome = this._createAsyncOutcome();
    const timeoutMs = Math.max(0, this._config.listenerTimeout ?? 0);
    outcome.timeoutMs = timeoutMs;

    if (listeners.length === 0) {
      return outcome;
    }

    const queue = listeners.map((fn, index) => ({ fn, index }));
    const workerCount = Math.min(limit, queue.length);
    const workers: Promise<void>[] = [];

    for (let w = 0; w < workerCount; w++) {
      workers.push(
        (async () => {
          while (queue.length > 0) {
            const work = queue.shift();
            if (!work) {
              break;
            }
            const { fn, index } = work;
            const startedAt = Date.now();
            try {
              const task = Promise.resolve(fn(eventData));
              await this._wrapWithListenerTimeout(task, index, mode, startedAt, timeoutMs, outcome);
            } catch (error) {
              this._recordAsyncError(outcome, index, error, mode);
            }
          }
        })()
      );
    }

    await Promise.all(workers);
    return outcome;
  }

  private _wrapWithListenerTimeout(
    promise: Promise<unknown>,
    index: number,
    mode: ConcurrencyMode,
    startedAt: number,
    timeoutMs: number,
    outcome: AsyncDispatchOutcome
  ): Promise<unknown> {
    if (!timeoutMs) {
      return promise;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const race = new Promise<unknown>((resolve, reject) => {
      timer = setTimeout(() => {
        const elapsed = Date.now() - startedAt;
        try {
          this._config.onListenerCancel?.({
            eventName: this.eventName,
            index,
            elapsed,
            mode,
          });
        } catch {
          /* no-op */ void 0;
        }

        if (this._debugMode && outcome.timeoutWarnCount < 3) {
          outcome.timeoutWarnCount++;
          this._errorReporter.reportTimeoutWarning(index, timeoutMs, mode);
        }

        this._metricsCollector.recordListenerTimeouts(1, "async");
      }, timeoutMs);

      promise.then(resolve, reject);
    });

    return race.finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    });
  }

  /** Safely update configuration (only runtime-safe config items allowed) */
  updateConfiguration(
    updates: Partial<
      Pick<
        EventConfiguration,
        | "batchSize"
        | "batchInterval"
        | "maxListeners"
        | "enableDebugMode"
        | "concurrencyMode"
        | "concurrencyLimit"
        | "logger"
        | "scheduler"
        | "payloadDedupe"
      >
    >
  ): this {
    const currentConfig = { ...this._config };

    // Only allow safe runtime updates
    const safeUpdates: Partial<EventConfiguration> = {};

    if (updates.batchSize !== undefined) {
      safeUpdates.batchSize = Math.max(1, Math.min(updates.batchSize, 1000));
    }

    if (updates.batchInterval !== undefined) {
      safeUpdates.batchInterval = Math.max(0, Math.min(updates.batchInterval, 1000));
    }

    if (updates.maxListeners !== undefined) {
      safeUpdates.maxListeners = Math.max(1, Math.min(updates.maxListeners, 10000));
    }

    if (updates.enableDebugMode !== undefined) {
      safeUpdates.enableDebugMode = updates.enableDebugMode;
      this._debugMode = updates.enableDebugMode;
    }

    const schedulerChanged = this._applyConcurrencyUpdates(updates, safeUpdates);

    if (updates.logger !== undefined) {
      safeUpdates.logger = updates.logger;
    }

    if (updates.payloadDedupe !== undefined) {
      safeUpdates.payloadDedupe = updates.payloadDedupe;
    }

    // Merge and freeze new config, maintaining read-only semantics
    const merged = { ...currentConfig, ...safeUpdates } as EventConfiguration;
    this._config = Object.freeze(merged);

    // Update configuration for various managers
    this._batchManager.updateConfiguration(this._config);
    this._dedupeManager.updateConfiguration(this._config);
    this._errorReporter.updateConfiguration(this._config);

    // Check if scheduler has changed
    if (schedulerChanged) {
      const schedulerDidChange = this._schedulerManager.updateConfiguration(this._config);
      if (schedulerDidChange && this._batchManager.batchCount > 0) {
        // If scheduler changed and there are unprocessed batches, need to reschedule
        // Can reschedule via batch manager here
      }
    }

    return this;
  }

  private _applyConcurrencyUpdates(
    updates: Partial<EventConfiguration>,
    safeUpdates: Partial<EventConfiguration>
  ): boolean {
    let schedulerChanged = false;

    if (updates.concurrencyMode !== undefined) {
      const mode = updates.concurrencyMode;
      if (mode === "series" || mode === "parallel" || mode === "limited") {
        safeUpdates.concurrencyMode = mode;
      } else {
        this._errorReporter.reportConfigError(`Invalid concurrencyMode: ${String(mode)}`);
      }
    }

    if (updates.concurrencyLimit !== undefined) {
      const normalized = Math.max(1, Math.min(Math.floor(updates.concurrencyLimit), 1000));
      safeUpdates.concurrencyLimit = normalized;
    }

    if (updates.scheduler !== undefined) {
      safeUpdates.scheduler = updates.scheduler;
      schedulerChanged = true;
    }

    return schedulerChanged;
  }

  /** Provides read-only configuration access */
  get configuration(): Readonly<EventConfiguration> {
    return this._config;
  }

  /** Force processing of current batch */
  flushBatch(): void {
    // Get batch data and process
    const batchData = this._batchManager.getBatchData();
    batchData.forEach((data) => this._fireImmediate(data));
    this._batchManager.clear();
  }

  /** Set lightweight data validator (only effective in debug mode) */
  setValidator(validator?: (data: T) => boolean): this {
    this._dataValidator = validator;
    return this;
  }

  /** Get current listener count */
  get listenerCount(): number {
    return this._listeners.length;
  }

  /** Get event fire count */
  get fireCount(): number {
    return this._fireCount;
  }

  /** Get maximum listener count limit */
  get maxListeners(): number {
    return this._config.maxListeners;
  }

  /** Set maximum listener count limit */
  set maxListeners(value: number) {
    // Strict validation, reject invalid values
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10000) {
      this._errorReporter.reportConfigError(
        `Invalid maxListeners value: ${value}. Must be an integer between 1 and 10000`
      );
      return;
    }
    this.updateConfiguration({ maxListeners: value });
  }

  /** Clear all listeners */
  clear(): void {
    this._listeners.length = 0; // More efficient than reallocation
    this._listenerSet.clear();

    // Clear various managers
    this._batchManager.clear();
    this._dedupeManager.clear();

    // Update metrics
    this._metricsCollector.updateActiveListeners(this._listeners.length);
  }

  /** Check if there are listeners */
  hasListeners(): boolean {
    return this._listeners.length > 0;
  }

  /** Enable/disable debug mode */
  setDebugMode(enabled: boolean): this {
    this._debugMode = enabled;
    // Safely update by recreating config object
    this._config = Object.freeze({
      ...this._config,
      enableDebugMode: enabled,
    });
    this._errorReporter.updateConfiguration(this._config);
    return this;
  }

  /** Reset event state */
  reset(): void {
    this.clear();
    this._fireCount = 0;
  }

  /** Destructor - cleanup resources */
  dispose(): void {
    this.clear();
    this._metricsCollector.dispose();
  }
}
