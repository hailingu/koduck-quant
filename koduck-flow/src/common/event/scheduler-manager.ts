import type { EventConfiguration, Scheduler } from "./types";

/**
 * 调度器管理器
 * 负责任务调度、调度器身份识别和调度策略管理
 */
export class SchedulerManager {
  /** 当前调度器身份标记 */
  private _schedulerId: string | undefined;

  /** 当前调度器引用（用于身份比较） */
  private _schedulerRef: Scheduler | undefined;

  /** 事件配置 */
  private _config: Readonly<EventConfiguration>;

  constructor(config: Readonly<EventConfiguration>) {
    this._config = config;
    this._schedulerId = this._schedulerIdentity();
    this._schedulerRef = this._config.scheduler;
  }

  /**
   * 调度一个函数执行
   * @param fn 要执行的函数
   * @param delay 延迟时间（毫秒）
   * @param useRAF 是否优先使用 requestAnimationFrame
   * @returns 调度 ID，用于取消调度
   */
  schedule(
    fn: () => void,
    delay: number = 0,
    useRAF: boolean = false
  ): {
    id: number;
    isRAF: boolean;
  } {
    // 优先使用注入调度器
    const injected = this._config.scheduler;
    if (injected) {
      const id = injected.schedule(fn, delay);
      return {
        id,
        isRAF: injected.kind === "raf",
      };
    }

    const shouldUseTimeout = delay > 0 || !useRAF || typeof requestAnimationFrame !== "function";

    if (shouldUseTimeout) {
      return {
        id: setTimeout(fn, delay) as unknown as number,
        isRAF: false,
      };
    } else {
      return {
        id: requestAnimationFrame(() => fn()) as unknown as number,
        isRAF: true,
      };
    }
  }

  /**
   * 取消调度
   * @param id 调度 ID
   * @param isRAF 是否为 requestAnimationFrame 调度
   */
  cancel(id: number, isRAF: boolean): void {
    // 注入式调度器优先
    const injected = this._config.scheduler;
    if (injected) {
      injected.cancel(id);
      return;
    }

    if (isRAF && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(id as unknown as number);
    } else {
      clearTimeout(id as unknown as number);
    }
  }

  /**
   * 获取调度器身份标识
   */
  getSchedulerId(): string {
    return this._schedulerId || this._schedulerIdentity();
  }

  /**
   * 更新配置并检查调度器是否发生变化
   * @param newConfig 新的事件配置
   * @returns 调度器是否发生变化
   */
  updateConfiguration(newConfig: Readonly<EventConfiguration>): boolean {
    const oldSchedulerRef = this._schedulerRef;
    const oldSchedulerId = this._schedulerId;

    this._config = newConfig;
    this._schedulerRef = newConfig.scheduler;

    const identityChanged = oldSchedulerRef !== this._schedulerRef;
    const newId = this._schedulerIdentity();
    const stringChanged = newId !== oldSchedulerId;

    if (identityChanged || stringChanged) {
      this._schedulerId = newId;
      return true;
    }

    return false;
  }

  /**
   * 获取当前调度器的详细信息
   */
  getSchedulerInfo(): {
    kind: string;
    isCustom: boolean;
    supportsRAF: boolean;
  } {
    const scheduler = this._config.scheduler;
    if (scheduler) {
      return {
        kind: scheduler.kind,
        isCustom: true,
        supportsRAF: scheduler.kind === "raf",
      };
    }

    const supportsRAF = typeof requestAnimationFrame === "function";
    return {
      kind: supportsRAF ? "raf" : "timeout",
      isCustom: false,
      supportsRAF,
    };
  }

  /**
   * 生成调度器身份标识
   */
  private _schedulerIdentity(): string {
    const s = this._config.scheduler;
    if (!s) {
      return "builtin:" + (typeof requestAnimationFrame === "function" ? "raf" : "timeout");
    }
    return `${s.kind}`;
  }
}
