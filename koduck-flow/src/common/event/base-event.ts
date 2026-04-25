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
 * 事件基类，支持批处理、异步操作和错误处理
 *
 * @template T 事件数据类型
 * @abstract
 * @since 1.0.0
 */
export abstract class BaseEvent<T> {
  /** 事件监听器数组 */
  protected _listeners: IEventListener<T>[] = [];

  /** 事件监听器集合，用于O(1)查找 */
  private readonly _listenerSet = new Set<IEventListener<T>>();

  /** 事件名称标识符 */
  protected readonly eventName: string;

  /** 事件触发次数 */
  private _fireCount: number = 0;

  /** 调试模式标志 */
  private _debugMode: boolean = false;

  /** 事件配置 */
  private _config: Readonly<EventConfiguration>;

  /** 数据验证器（轻量级 - 仅在调试模式下激活） */
  private _dataValidator: ((data: T) => boolean) | undefined;

  // ===== 管理器实例 =====
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

    // 支持预设配置或自定义配置
    if (typeof configOrPreset === "string") {
      this._config = Object.freeze({ ...EVENT_PRESETS[configOrPreset] });
    } else {
      this._config = Object.freeze(EventConfigValidator.validate(configOrPreset || {}));
    }

    // 根据配置初始化调试模式
    this._debugMode = this._config.enableDebugMode;

    // 初始化监听器快照对象池（使用依赖注入，默认使用全局实例）
    this._listenerSnapshotPool = listenerSnapshotPool || defaultListenerSnapshotPool;

    // 初始化各个管理器
    this._batchManager = new BatchManager<T>(this._config);
    this._dedupeManager = new DedupeManager<T>(eventName, this._config);
    this._schedulerManager = new SchedulerManager(this._config);
    this._errorReporter = new ErrorReporter(eventName, this._config);
    this._metricsCollector = new MetricsCollector(eventName, () => this._batchManager.batchCount);
  }

  /**
   * 获取事件注册器（实现 IEvent 接口）
   * @returns 事件注册函数
   */
  get event(): IEvent<T> {
    return (listener: IEventListener<T>): (() => void) => {
      return this.addEventListener(listener);
    };
  }

  /** 添加事件监听器 */
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
      // 返回空的取消函数
      return () => {};
    }

    // 检查监听器数量限制
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
      // 返回空的取消函数
      return () => {};
    }

    // 允许同一监听器多次注册
    this._listeners.push(listener);
    this._listenerSet.add(listener);

    // 更新 metrics
    this._metricsCollector.updateActiveListeners(this._listeners.length);

    // 返回取消注册的函数
    return () => {
      const index = this._listeners.indexOf(listener);
      if (index > -1) {
        this._listeners.splice(index, 1);
        // 只有在没有其他相同listener时才从Set中删除
        if (!this._listeners.includes(listener)) {
          this._listenerSet.delete(listener);
        }
        this._metricsCollector.updateActiveListeners(this._listeners.length);
      }
    };
  }

  /** 移除事件监听器 */
  removeEventListener(listener: IEventListener<T>): boolean {
    if (!this._listenerSet.has(listener)) {
      return false;
    }

    const index = this._listeners.indexOf(listener);
    if (index > -1) {
      this._listeners.splice(index, 1);
      // 仅当数组中不再包含该 listener 时再从 Set 删除
      if (!this._listeners.includes(listener)) {
        this._listenerSet.delete(listener);
      }
      this._metricsCollector.updateActiveListeners(this._listeners.length);
      return true;
    }
    return false;
  }

  /** 批量注册监听器，支持链式调用 */
  addListeners(...listeners: IEventListener<T>[]): this {
    listeners.forEach((listener) => this.addEventListener(listener));
    return this;
  }

  /** 一次性监听器 - 触发一次后自动移除 */
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

  /** 条件监听器 - 只有满足条件才触发 */
  when(condition: (data: T) => boolean, listener: IEventListener<T>): this {
    const conditionalListener: IEventListener<T> = (data) => {
      if (condition(data)) listener(data);
    };
    this.addEventListener(conditionalListener);
    return this;
  }

  /** 触发事件（智能批处理选择） */
  fire(eventData: T): void {
    // 可选：负载去重（同步路径）
    if (this._dedupeManager.shouldDropByDedupe(eventData)) return;

    // 轻量级验证 - 只在调试模式下执行
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

  /** 立即触发事件（不使用批处理） */
  private _fireImmediate(eventData: T): void {
    this._fireCount++;

    // 记录 metrics
    this._metricsCollector.recordEmitted("sync");

    if (this._listeners.length === 0) {
      return;
    }

    // 使用快照，避免触发期间对监听器数组的增删影响迭代
    const listeners = this._listenerSnapshotPool.borrowSnapshot(this._listeners);
    const listenerCount = listeners.length;

    // 记录监听器调用
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
          // 收集详细错误信息
          if (errorCount <= 3) {
            errors.push({ index: i, error });
          }
        }
      }
    } finally {
      this._listenerSnapshotPool.releaseSnapshot(listeners);
    }

    // 记录分发持续时间和错误
    const dt = Date.now() - t0;
    this._metricsCollector.recordDispatchDuration(dt, "sync");
    this._metricsCollector.recordListenerErrors(errorCount, "sync");

    // 统一的错误报告
    if (errorCount > 0) {
      this._errorReporter.reportErrors(errors);
    }
  }

  /** 异步触发事件 */
  async fireAsync(eventData: T): Promise<void> {
    // 可选：负载去重（异步路径）
    if (this._dedupeManager.shouldDropByDedupe(eventData)) return;

    this._fireCount++;
    this._metricsCollector.recordEmitted("async");

    if (this._listeners.length === 0) {
      return;
    }

    // 使用快照以避免迭代期间的结构性变化
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

    // 汇总告警（限流模式）
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

    // 简化错误报告
    if (outcome.errorCount > 0 && this._debugMode) {
      if (outcome.errorCount > 3) {
        // 通过错误报告器报告简化的错误信息
      }
    }

    // 记录分发持续时间和错误（异步）
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

  /** 安全地更新配置（仅允许运行时安全的配置项） */
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

    // 只允许安全的运行时更新
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

    // 合并并冻结新配置，保持只读语义
    const merged = { ...currentConfig, ...safeUpdates } as EventConfiguration;
    this._config = Object.freeze(merged);

    // 更新各个管理器的配置
    this._batchManager.updateConfiguration(this._config);
    this._dedupeManager.updateConfiguration(this._config);
    this._errorReporter.updateConfiguration(this._config);

    // 检查调度器是否发生变化
    if (schedulerChanged) {
      const schedulerDidChange = this._schedulerManager.updateConfiguration(this._config);
      if (schedulerDidChange && this._batchManager.batchCount > 0) {
        // 如果调度器发生变化且有未处理批次，需要重新调度
        // 这里可以通过批处理管理器重新调度
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

  /** 提供只读配置访问 */
  get configuration(): Readonly<EventConfiguration> {
    return this._config;
  }

  /** 强制处理当前批次 */
  flushBatch(): void {
    // 获取批次数据并处理
    const batchData = this._batchManager.getBatchData();
    batchData.forEach((data) => this._fireImmediate(data));
    this._batchManager.clear();
  }

  /** 设置轻量级数据验证器（仅在调试模式生效） */
  setValidator(validator?: (data: T) => boolean): this {
    this._dataValidator = validator;
    return this;
  }

  /** 获取当前监听器数量 */
  get listenerCount(): number {
    return this._listeners.length;
  }

  /** 获取事件触发次数 */
  get fireCount(): number {
    return this._fireCount;
  }

  /** 获取最大监听器数量限制 */
  get maxListeners(): number {
    return this._config.maxListeners;
  }

  /** 设置最大监听器数量限制 */
  set maxListeners(value: number) {
    // 严格验证，拒绝无效值
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10000) {
      this._errorReporter.reportConfigError(
        `Invalid maxListeners value: ${value}. Must be an integer between 1 and 10000`
      );
      return;
    }
    this.updateConfiguration({ maxListeners: value });
  }

  /** 清除所有监听器 */
  clear(): void {
    this._listeners.length = 0; // 比重新分配更高效
    this._listenerSet.clear();

    // 清理各个管理器
    this._batchManager.clear();
    this._dedupeManager.clear();

    // 更新 metrics
    this._metricsCollector.updateActiveListeners(this._listeners.length);
  }

  /** 检查是否有监听器 */
  hasListeners(): boolean {
    return this._listeners.length > 0;
  }

  /** 启用/禁用调试模式 */
  setDebugMode(enabled: boolean): this {
    this._debugMode = enabled;
    // 通过重新创建配置对象来安全地更新
    this._config = Object.freeze({
      ...this._config,
      enableDebugMode: enabled,
    });
    this._errorReporter.updateConfiguration(this._config);
    return this;
  }

  /** 重置事件状态 */
  reset(): void {
    this.clear();
    this._fireCount = 0;
  }

  /** 析构函数 - 清理资源 */
  dispose(): void {
    this.clear();
    this._metricsCollector.dispose();
  }
}
