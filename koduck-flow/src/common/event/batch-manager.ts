import type { EventConfiguration } from "./types";

/**
 * 批处理管理器
 * 负责事件的批量处理、缓冲区管理和调度
 */
export class BatchManager<T> {
  /** 批处理循环缓冲区 */
  private _batchBuffer: T[];

  /** 批处理缓冲区起始索引 */
  private _batchStartIndex = 0;

  /** 批处理缓冲区结束索引 */
  private _batchEndIndex = 0;

  /** 当前批处理数量 */
  private _batchCount = 0;

  /** 批处理定时器句柄 */
  private _batchTimer: number | null = null;

  /** 批处理是否使用 rAF（用于正确取消） */
  private _batchTimerIsRAF: boolean = false;

  /** 事件配置 */
  private _config: Readonly<EventConfiguration>;

  constructor(config: Readonly<EventConfiguration>) {
    this._config = config;
    // 动态分配缓冲区大小，避免内存浪费
    const bufferSize = Math.max(this._config.batchSize * 2, 50);
    this._batchBuffer = new Array(bufferSize);
  }

  /**
   * 判断是否应该使用批处理
   * @param listenerCount 当前监听器数量
   */
  shouldUseBatchProcessing(listenerCount: number): boolean {
    if (!this._config.enableBatching) return false;
    if (!this._config.enableAutoOptimization) return true;
    return listenerCount > this._config.autoOptimizeThreshold;
  }

  /**
   * 添加事件到批处理队列
   * @param eventData 事件数据
   * @param onProcessItem 处理单个事件项的回调
   */
  addToBatch(eventData: T, onProcessItem: (data: T) => void): void {
    // 添加到循环缓冲区
    this._batchBuffer[this._batchEndIndex] = eventData;
    this._batchEndIndex = (this._batchEndIndex + 1) % this._batchBuffer.length;

    // 简化计数逻辑
    this._batchCount = Math.min(this._batchCount + 1, this._batchBuffer.length);

    // 如果缓冲区满，自动调整起始位置
    if (this._batchCount === this._batchBuffer.length) {
      this._batchStartIndex = this._batchEndIndex;
    }

    // 如果队列达到批处理大小，立即处理
    if (this._batchCount >= this._config.batchSize) {
      this._processBatchWithCallback(onProcessItem);
      return;
    }

    // 根据配置与环境调度（rAF 或 setTimeout）
    if (!this._batchTimer) {
      this._batchTimer = this._scheduleBatch(() => {
        this._processBatchWithCallback(onProcessItem);
      });
    }
  }

  /**
   * 处理批处理队列
   * @param onProcessItem 处理单个事件的回调
   */
  processBatch(onProcessItem: () => void): void {
    if (this._batchCount === 0) {
      return;
    }

    // 清除定时器
    if (this._batchTimer) {
      this._cancelBatch(this._batchTimer);
      this._batchTimer = null;
    }

    // 处理循环缓冲区中的事件
    const currentBatchCount = this._batchCount;
    for (let i = 0; i < currentBatchCount; i++) {
      // 获取并移除队首事件
      this._batchStartIndex =
        (this._batchStartIndex + 1) % this._batchBuffer.length;
      this._batchCount--;
      // 通过回调处理单个事件
      onProcessItem();
    }
  }

  /**
   * 使用回调处理批处理队列中的具体数据
   * @param onProcessItem 处理单个事件数据的回调
   */
  private _processBatchWithCallback(onProcessItem: (data: T) => void): void {
    if (this._batchCount === 0) {
      return;
    }

    // 清除定时器
    if (this._batchTimer) {
      this._cancelBatch(this._batchTimer);
      this._batchTimer = null;
    }

    // 处理循环缓冲区中的事件
    const currentBatchCount = this._batchCount;
    for (let i = 0; i < currentBatchCount; i++) {
      const eventData = this._batchBuffer[this._batchStartIndex];
      this._batchStartIndex =
        (this._batchStartIndex + 1) % this._batchBuffer.length;
      this._batchCount--;
      // 通过回调处理具体的事件数据
      onProcessItem(eventData);
    }
  }

  /**
   * 获取当前批次中的事件数据
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
   * 强制处理当前批次
   * @param onProcessItem 处理单个事件的回调
   */
  flushBatch(onProcessItem: () => void): void {
    if (this._batchCount > 0) {
      this.processBatch(onProcessItem);
    }
  }

  /**
   * 获取当前批次数量
   */
  get batchCount(): number {
    return this._batchCount;
  }

  /**
   * 更新配置
   */
  updateConfiguration(newConfig: Readonly<EventConfiguration>): void {
    const oldConfig = this._config;
    this._config = newConfig;

    // 如果批处理大小改变，重新分配缓冲区
    if (newConfig.batchSize !== oldConfig.batchSize) {
      this._resizeBatchBuffer();
    }

    // 若批处理间隔改变，且存在未处理批次，则按新策略重置调度
    if (
      newConfig.batchInterval !== oldConfig.batchInterval &&
      this._batchCount > 0 &&
      this._batchTimer
    ) {
      this._cancelBatch(this._batchTimer);
      this._batchTimer = this._scheduleBatch(() => {
        // 需要从外部传入处理函数，这里先保留空实现
      });
    }
  }

  /**
   * 清理批处理状态
   */
  clear(): void {
    // 清理批处理缓冲区中的引用
    if (this._batchBuffer) {
      for (let i = 0; i < this._batchBuffer.length; i++) {
        this._batchBuffer[i] = undefined as unknown as T; // 清除引用
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
   * 重新分配批处理缓冲区
   */
  private _resizeBatchBuffer(): void {
    const newSize = Math.max(this._config.batchSize * 2, 50);
    const oldBuffer = this._batchBuffer;

    this._batchBuffer = new Array(newSize);
    if (this._batchCount > 0) {
      // 保留现有数据
      for (let i = 0; i < this._batchCount; i++) {
        const sourceIndex = (this._batchStartIndex + i) % oldBuffer.length;
        this._batchBuffer[i] = oldBuffer[sourceIndex];
      }
      this._batchStartIndex = 0;
      this._batchEndIndex = this._batchCount;
    }
  }

  /**
   * 根据配置与环境调度批处理任务（rAF 或 setTimeout）
   */
  private _scheduleBatch(fn: () => void): number {
    // 优先使用注入调度器
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
   * 取消批处理定时
   */
  private _cancelBatch(id: number): void {
    // 注入式调度器优先
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
