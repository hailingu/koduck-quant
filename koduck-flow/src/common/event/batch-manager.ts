import type { EventConfiguration } from "./types";

/**
 * Batch manager
 * Responsible for event batch processing, buffer management, and scheduling
 */
export class BatchManager<T> {
  /** Batch circular buffer */
  private _batchBuffer: T[];

  /** Batch buffer start index */
  private _batchStartIndex = 0;

  /** Batch buffer end index */
  private _batchEndIndex = 0;

  /** Current batch count */
  private _batchCount = 0;

  /** Batch timer handle */
  private _batchTimer: number | null = null;

  /** Whether batch uses rAF (for proper cancellation) */
  private _batchTimerIsRAF: boolean = false;

  /** Event configuration */
  private _config: Readonly<EventConfiguration>;

  constructor(config: Readonly<EventConfiguration>) {
    this._config = config;
    // Dynamically allocate buffer size to avoid memory waste
    const bufferSize = Math.max(this._config.batchSize * 2, 50);
    this._batchBuffer = new Array(bufferSize);
  }

  /**
   * Determine whether batch processing should be used
   * @param listenerCount Current listener count
   */
  shouldUseBatchProcessing(listenerCount: number): boolean {
    if (!this._config.enableBatching) return false;
    if (!this._config.enableAutoOptimization) return true;
    return listenerCount > this._config.autoOptimizeThreshold;
  }

  /**
   * Add event to batch queue
   * @param eventData Event data
   * @param onProcessItem Callback to process a single event item
   */
  addToBatch(eventData: T, onProcessItem: (data: T) => void): void {
    // Add to circular buffer
    this._batchBuffer[this._batchEndIndex] = eventData;
    this._batchEndIndex = (this._batchEndIndex + 1) % this._batchBuffer.length;

    // Simplify count logic
    this._batchCount = Math.min(this._batchCount + 1, this._batchBuffer.length);

    // If buffer is full, auto-adjust start position
    if (this._batchCount === this._batchBuffer.length) {
      this._batchStartIndex = this._batchEndIndex;
    }

    // If queue reaches batch size, process immediately
    if (this._batchCount >= this._config.batchSize) {
      this._processBatchWithCallback(onProcessItem);
      return;
    }

    // Schedule based on config and environment (rAF or setTimeout)
    if (!this._batchTimer) {
      this._batchTimer = this._scheduleBatch(() => {
        this._processBatchWithCallback(onProcessItem);
      });
    }
  }

  /**
   * Process batch queue
   * @param onProcessItem Callback to process a single event
   */
  processBatch(onProcessItem: () => void): void {
    if (this._batchCount === 0) {
      return;
    }

    // Clear timer
    if (this._batchTimer) {
      this._cancelBatch(this._batchTimer);
      this._batchTimer = null;
    }

    // Process events in circular buffer
    const currentBatchCount = this._batchCount;
    for (let i = 0; i < currentBatchCount; i++) {
      // Get and remove front event
      this._batchStartIndex =
        (this._batchStartIndex + 1) % this._batchBuffer.length;
      this._batchCount--;
      // Process single event via callback
      onProcessItem();
    }
  }

  /**
   * Process concrete data in batch queue using callback
   * @param onProcessItem Callback to process a single event data
   */
  private _processBatchWithCallback(onProcessItem: (data: T) => void): void {
    if (this._batchCount === 0) {
      return;
    }

    // Clear timer
    if (this._batchTimer) {
      this._cancelBatch(this._batchTimer);
      this._batchTimer = null;
    }

    // Process events in circular buffer
    const currentBatchCount = this._batchCount;
    for (let i = 0; i < currentBatchCount; i++) {
      const eventData = this._batchBuffer[this._batchStartIndex];
      this._batchStartIndex =
        (this._batchStartIndex + 1) % this._batchBuffer.length;
      this._batchCount--;
      // Process concrete event data via callback
      onProcessItem(eventData);
    }
  }

  /**
   * Get event data in current batch
   */
  getBatchData(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this._batchCount; i++) {
      const index = (this._batchStartIndex + i) % this._batchBuffer.length;
      result.push(this._batchBuffer[index]);
    }
    return result;
  }

  /**
   * Force process current batch
   * @param onProcessItem Callback to process a single event
   */
  flushBatch(onProcessItem: () => void): void {
    if (this._batchCount > 0) {
      this.processBatch(onProcessItem);
    }
  }

  /**
   * Get current batch count
   */
  get batchCount(): number {
    return this._batchCount;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig: Readonly<EventConfiguration>): void {
    const oldConfig = this._config;
    this._config = newConfig;

    // If batch size changes, reallocate buffer
    if (newConfig.batchSize !== oldConfig.batchSize) {
      this._resizeBatchBuffer();
    }

    // If batch interval changes and there are unprocessed batches, reset scheduling with new policy
    if (
      newConfig.batchInterval !== oldConfig.batchInterval &&
      this._batchCount > 0 &&
      this._batchTimer
    ) {
      this._cancelBatch(this._batchTimer);
      this._batchTimer = this._scheduleBatch(() => {
        // Processing function needs to be passed from outside; keep empty implementation here
      });
    }
  }

  /**
   * Clear batch processing state
   */
  clear(): void {
    // Clear references in batch buffer
    if (this._batchBuffer) {
      for (let i = 0; i < this._batchBuffer.length; i++) {
        this._batchBuffer[i] = undefined as unknown as T; // Clear reference
      }
    }

    this._batchStartIndex = 0;
    this._batchEndIndex = 0;
    this._batchCount = 0;

    if (this._batchTimer) {
      this._cancelBatch(this._batchTimer);
      this._batchTimer = null;
    }
  }

  /**
   * Reallocate batch buffer
   */
  private _resizeBatchBuffer(): void {
    const newSize = Math.max(this._config.batchSize * 2, 50);
    const oldBuffer = this._batchBuffer;

    this._batchBuffer = new Array(newSize);
    if (this._batchCount > 0) {
      // Preserve existing data
      for (let i = 0; i < this._batchCount; i++) {
        const sourceIndex = (this._batchStartIndex + i) % oldBuffer.length;
        this._batchBuffer[i] = oldBuffer[sourceIndex];
      }
      this._batchStartIndex = 0;
      this._batchEndIndex = this._batchCount;
    }
  }

  /**
   * Schedule batch processing task based on config and environment (rAF or setTimeout)
   */
  private _scheduleBatch(fn: () => void): number {
    // Prefer injected scheduler
    const injected = this._config.scheduler;
    if (injected) {
      this._batchTimerIsRAF = injected.kind === "raf";
      return injected.schedule(fn, this._config.batchInterval || 0);
    }

    const useTimeout =
      this._config.batchInterval > 0 ||
      typeof requestAnimationFrame !== "function";

    if (useTimeout) {
      this._batchTimerIsRAF = false;
      return setTimeout(
        fn,
        this._config.batchInterval || 0
      ) as unknown as number;
    } else {
      this._batchTimerIsRAF = true;
      return requestAnimationFrame(() => fn()) as unknown as number;
    }
  }

  /**
   * Cancel batch timer
   */
  private _cancelBatch(id: number): void {
    // Injected scheduler takes priority
    const injected = this._config.scheduler;
    if (injected) {
      injected.cancel(id);
      return;
    }
    if (this._batchTimerIsRAF && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(id as unknown as number);
    } else {
      clearTimeout(id as unknown as number);
    }
  }
}
