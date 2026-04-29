import type { EventConfiguration, Scheduler } from "./types";

/**
 * Scheduler manager
 * Responsible for task scheduling, scheduler identity recognition, and scheduling policy management
 */
export class SchedulerManager {
  /** Current scheduler identity marker */
  private _schedulerId: string | undefined;

  /** Current scheduler reference (for identity comparison) */
  private _schedulerRef: Scheduler | undefined;

  /** Event configuration */
  private _config: Readonly<EventConfiguration>;

  constructor(config: Readonly<EventConfiguration>) {
    this._config = config;
    this._schedulerId = this._schedulerIdentity();
    this._schedulerRef = this._config.scheduler;
  }

  /**
   * Schedule a function for execution
   * @param fn Function to execute
   * @param delay Delay time in milliseconds
   * @param useRAF Whether to prefer requestAnimationFrame
   * @returns Schedule ID, used to cancel scheduling
   */
  schedule(
    fn: () => void,
    delay: number = 0,
    useRAF: boolean = false
  ): {
    id: number;
    isRAF: boolean;
  } {
    // Prefer injected scheduler
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
   * Cancel scheduling
   * @param id Schedule ID
   * @param isRAF Whether it's a requestAnimationFrame schedule
   */
  cancel(id: number, isRAF: boolean): void {
    // Injected scheduler takes precedence
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
   * Get scheduler identity identifier
   */
  getSchedulerId(): string {
    return this._schedulerId || this._schedulerIdentity();
  }

  /**
   * Update configuration and check if scheduler has changed
   * @param newConfig New event configuration
   * @returns Whether scheduler has changed
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
   * Get current scheduler details
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
   * Generate scheduler identity identifier
   */
  private _schedulerIdentity(): string {
    const s = this._config.scheduler;
    if (!s) {
      return "builtin:" + (typeof requestAnimationFrame === "function" ? "raf" : "timeout");
    }
    return `${s.kind}`;
  }
}
