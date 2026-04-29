import { Script, createContext, type Context as VMContext } from "node:vm";
import { setTimeout as setNodeTimeout, clearTimeout as clearNodeTimeout } from "node:timers";
import type { LoggerContextAdapter } from "../logger";
import { logger as globalLogger } from "../logger";
import { getConfig } from "../config/loader";

export type PluginSandboxState = "created" | "initialized" | "attached" | "disposed";
export type PluginLifecyclePhase = "onInit" | "onAttach" | "onDispose" | "evaluation";

export interface PluginLifecycle<TInit = unknown, TAttach = unknown, TDispose = unknown> {
  onInit?(context: TInit): Promise<void> | void;
  onAttach?(context: TAttach): Promise<void> | void;
  onDispose?(context: TDispose): Promise<void> | void;
}

export interface PluginSandboxHelpers {
  readonly id: string;
  readonly metadata: Record<string, unknown>;
  readonly logger: LoggerContextAdapter;
  readonly getState: () => PluginSandboxState;
  registerCleanup(callback: () => Promise<void> | void): void;
}

export type PluginFactory = (
  helpers: PluginSandboxHelpers
) =>
  | PluginLifecycle
  | Promise<PluginLifecycle>
  | (() => PluginLifecycle | Promise<PluginLifecycle>);

export interface PluginSandboxRunnerOptions {
  /** 唯一插件 ID，用于日志和错误提示 */
  id: string;
  /** 插件源码（打包后脚本），将在沙箱内执行 */
  code: string;
  /**
   * 脚本执行与生命周期调用的超时（毫秒）。
   * 超时后会中断并抛出 PluginLifecycleTimeoutError。
   */
  timeoutMs?: number;
  /** 自定义注入到沙箱的全局变量集合 */
  globals?: Record<string, unknown>;
  /** 插件自定义元数据，将通过 helpers.metadata 提供给插件 */
  metadata?: Record<string, unknown>;
  /** 自定义日志适配器，默认使用全局 logger */
  logger?: LoggerContextAdapter;
  /** 沙箱 API 名称。默认值：__koduckFlowSandbox */
  apiName?: string;
}

export class PluginSandboxError extends Error {
  readonly pluginId: string;
  readonly phase: PluginLifecyclePhase;

  constructor(message: string, pluginId: string, phase: PluginLifecyclePhase, cause?: unknown) {
    super(message);
    this.name = "PluginSandboxError";
    this.pluginId = pluginId;
    this.phase = phase;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export class PluginRegistrationError extends PluginSandboxError {
  constructor(pluginId: string, message: string, cause?: unknown) {
    super(message, pluginId, "evaluation", cause);
    this.name = "PluginRegistrationError";
  }
}

export class PluginLifecycleInvocationError extends PluginSandboxError {
  constructor(pluginId: string, phase: PluginLifecyclePhase, cause: unknown) {
    super(
      `Plugin "${pluginId}" lifecycle "${phase}" failed: ${(cause as Error)?.message ?? cause}`,
      pluginId,
      phase,
      cause
    );
    this.name = "PluginLifecycleInvocationError";
  }
}

export class PluginLifecycleTimeoutError extends PluginLifecycleInvocationError {
  readonly timeoutMs: number;

  constructor(pluginId: string, phase: PluginLifecyclePhase, timeoutMs: number) {
    super(pluginId, phase, new Error(`Lifecycle timed out after ${timeoutMs}ms`));
    this.name = "PluginLifecycleTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

const DEFAULT_TIMEOUT_MS = getConfig().plugin.sandboxTimeout;
const DEFAULT_API_NAME = "__koduckFlowSandbox";

interface RegistrationRecord {
  value?: unknown;
}

function isPromiseLike<T = unknown>(value: unknown): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).then === "function";
}

function isLifecycle(value: unknown): value is PluginLifecycle {
  return Boolean(value && typeof value === "object");
}

export class PluginSandboxRunner<TInit = unknown, TAttach = unknown, TDispose = unknown> {
  private readonly options: Required<PluginSandboxRunnerOptions>;
  private readonly script: Script;
  private readonly logger: LoggerContextAdapter;
  private state: PluginSandboxState = "created";
  private lifecycle: PluginLifecycle<TInit, TAttach, TDispose> | null = null;
  private readonly cleanupCallbacks: Array<() => Promise<void> | void> = [];

  constructor(options: PluginSandboxRunnerOptions) {
    if (!options.id) {
      throw new PluginRegistrationError("unknown", "Plugin id is required");
    }
    if (!options.code) {
      throw new PluginRegistrationError(options.id, "Plugin code is required");
    }

    this.options = {
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      globals: options.globals ?? {},
      metadata: options.metadata ?? {},
      logger:
        options.logger ??
        globalLogger.withContext({
          tag: `plugin:${options.id}`,
          metadata: { pluginId: options.id },
        }),
      apiName: options.apiName ?? DEFAULT_API_NAME,
      id: options.id,
      code: options.code,
    };

    this.logger = this.options.logger;
    this.script = new Script(this.options.code, {
      filename: `${this.options.id}.plugin.js`,
    });
  }

  getState(): PluginSandboxState {
    return this.state;
  }

  async init(context?: TInit): Promise<void> {
    if (this.state === "disposed") {
      throw new PluginSandboxError("Plugin already disposed", this.options.id, "onInit");
    }
    if (this.state !== "created") {
      return;
    }

    await this.ensureLifecycle();
    await this.invokeLifecycle("onInit", context);
    this.state = "initialized";
  }

  async attach(context?: TAttach): Promise<void> {
    if (this.state === "disposed") {
      throw new PluginSandboxError("Plugin already disposed", this.options.id, "onAttach");
    }
    if (this.state === "created") {
      await this.init(undefined);
    }
    if (this.state === "attached") {
      throw new PluginSandboxError("Plugin already attached", this.options.id, "onAttach");
    }

    await this.invokeLifecycle("onAttach", context);
    this.state = "attached";
  }

  async dispose(context?: TDispose): Promise<void> {
    if (this.state === "disposed") {
      return;
    }

    let disposeError: unknown;
    try {
      await this.invokeLifecycle("onDispose", context);
    } catch (error) {
      disposeError = error;
    }

    await this.runCleanupCallbacks();
    this.state = "disposed";
    this.lifecycle = null;

    if (disposeError) {
      throw disposeError;
    }
  }

  private async ensureLifecycle(): Promise<void> {
    if (this.lifecycle) {
      return;
    }

    const registration: RegistrationRecord = {};
    const context = this.createVmContext(registration);

    try {
      this.script.runInContext(context, { timeout: this.options.timeoutMs });
    } catch (error) {
      throw new PluginRegistrationError(
        this.options.id,
        `Failed to evaluate plugin script: ${(error as Error).message}`,
        error
      );
    }

    const exported = registration.value ?? this.resolveModuleExports(context);
    const lifecycle = await this.resolveLifecycle(exported);
    this.lifecycle = lifecycle;
    this.logger.debug({
      event: "plugin-registered",
      metadata: { pluginId: this.options.id },
    });
  }

  private createVmContext(registration: RegistrationRecord): VMContext {
    const sandboxGlobals: Record<string, unknown> = {
      console,
      setTimeout,
      clearTimeout,
      TextEncoder,
      TextDecoder,
      performance,
      ...this.options.globals,
    };

    const context = createContext(sandboxGlobals);
    const module = { exports: {} as unknown };

    const helpers = this.createHelpers();
    const api = {
      register: (value: unknown) => {
        if (registration.value) {
          throw new PluginRegistrationError(this.options.id, "Plugin registered multiple times");
        }
        registration.value = value;
      },
      helpers,
      id: this.options.id,
    };

    (context as Record<string, unknown>).module = module;
    (context as Record<string, unknown>).exports = module.exports;
    (context as Record<string, unknown>).require = undefined;
    (context as Record<string, unknown>).global = context;
    (context as Record<string, unknown>).globalThis = context;
    (context as Record<string, unknown>)[this.options.apiName] = api;

    return context;
  }

  private createHelpers(): PluginSandboxHelpers {
    return {
      id: this.options.id,
      metadata: { ...this.options.metadata },
      logger: this.logger,
      getState: () => this.state,
      registerCleanup: (callback: () => Promise<void> | void) => {
        this.cleanupCallbacks.push(callback);
      },
    };
  }

  private resolveModuleExports(context: VMContext): unknown {
    const module = (context as Record<string, unknown>).module as { exports: unknown } | undefined;
    if (!module) {
      throw new PluginRegistrationError(this.options.id, "module.exports missing in sandbox");
    }

    const exported = module.exports as { default?: unknown };
    if (exported && typeof exported === "object" && "default" in exported && exported.default) {
      return exported.default;
    }
    return exported;
  }

  private async resolveLifecycle(
    rawExport: unknown
  ): Promise<PluginLifecycle<TInit, TAttach, TDispose>> {
    let current = rawExport;

    if (current === undefined) {
      throw new PluginRegistrationError(this.options.id, "Plugin did not register any exports");
    }

    if (isPromiseLike(current)) {
      current = await current;
    }

    let iterations = 0;
    const helpers = this.createHelpers();

    while (typeof current === "function") {
      iterations += 1;
      if (iterations > 10) {
        throw new PluginRegistrationError(this.options.id, "Plugin factory recursion too deep");
      }

      const maybeResult = (current as PluginFactory)(helpers);
      current = isPromiseLike(maybeResult) ? await maybeResult : maybeResult;
    }

    if (!isLifecycle(current)) {
      throw new PluginRegistrationError(
        this.options.id,
        `Plugin export is not a lifecycle object (received ${typeof current})`
      );
    }

    return current as PluginLifecycle<TInit, TAttach, TDispose>;
  }

  private async invokeLifecycle(phase: keyof PluginLifecycle, context: unknown): Promise<void> {
    const lifecycle = this.lifecycle;
    if (!lifecycle) {
      return;
    }

    const handler = lifecycle[phase];
    if (!handler) {
      return;
    }

    try {
      const callable = handler as unknown as (
        this: PluginLifecycle<TInit, TAttach, TDispose>,
        payload: unknown
      ) => Promise<void> | void;
      const result = callable.call(lifecycle, context);
      await this.resolveWithTimeout(result, phase);
    } catch (error) {
      if (error instanceof PluginLifecycleTimeoutError) {
        throw error;
      }
      throw new PluginLifecycleInvocationError(this.options.id, phase, error);
    }
  }

  private async resolveWithTimeout<T>(
    result: T | Promise<T>,
    phase: PluginLifecyclePhase
  ): Promise<T> {
    if (!isPromiseLike(result)) {
      return result;
    }

    const timeout = this.options.timeoutMs;
    if (timeout <= 0) {
      return (await result) as T;
    }

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setNodeTimeout(() => {
        reject(new PluginLifecycleTimeoutError(this.options.id, phase, timeout));
      }, timeout);
    });

    try {
      return (await Promise.race([result, timeoutPromise])) as T;
    } finally {
      if (timer) {
        clearNodeTimeout(timer);
      }
    }
  }

  private async runCleanupCallbacks(): Promise<void> {
    while (this.cleanupCallbacks.length) {
      const callback = this.cleanupCallbacks.pop();
      if (!callback) continue;
      try {
        const result = callback();
        if (isPromiseLike(result)) {
          await result;
        }
      } catch (error) {
        this.logger.warn({
          event: "plugin-cleanup-error",
          metadata: { pluginId: this.options.id },
          error,
        });
      }
    }
  }
}
