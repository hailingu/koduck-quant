/**
 * @module src/common/runtime/runtime-controller
 * @description Runtime controller for managing KoduckFlow runtime instances with multi-tenancy support.
 * Provides centralized state management for runtime lifecycle, environment switching, and tenant context handling.
 * @example
 * ```typescript
 * const controller = new KoduckFlowRuntimeController({
 *   initialEnvironment: { environment: 'production', tenantId: 'tenant-1' },
 *   factory: runtimeFactory
 * });
 * const runtime = controller.getRuntime();
 * controller.subscribe(() => console.log('Runtime changed'));
 * ```
 */

import { logger } from "../logger";

import { KoduckFlowRuntime } from "./koduck-flow-runtime";
import { KoduckFlowRuntimeFactory, type RuntimeCreationOptions } from "./runtime-factory";
import type { RuntimeEnvironmentKey } from "./runtime-key";
import type { KoduckFlowTenantConfig, ResolvedTenantContext } from "./tenant-context";
import { resolveTenantContext } from "./tenant-context";

/**
 * Source identifier for runtime controller operations
 * - 'controller': Runtime set directly via controller API
 * - 'controller-factory': Runtime created through factory by controller
 * - 'controller-external': Runtime provided externally and adopted by controller
 * @typedef {string} RuntimeControllerSource
 */
export type RuntimeControllerSource = "controller" | "controller-factory" | "controller-external";

/**
 * Immutable snapshot of runtime controller state
 * @typedef {Object} RuntimeControllerSnapshot
 * @property {KoduckFlowRuntime|null} runtime - Current runtime instance or null if not initialized
 * @property {RuntimeEnvironmentKey} [environment] - Current runtime environment configuration
 * @property {ResolvedTenantContext} [tenant] - Current tenant context for multi-tenant isolation
 * @property {RuntimeControllerSource} source - Source identifier for current runtime
 * @property {Record<string, unknown>} [metadata] - Custom metadata attached to runtime state
 */
export type RuntimeControllerSnapshot = {
  runtime: KoduckFlowRuntime | null;
  environment?: RuntimeEnvironmentKey;
  tenant?: ResolvedTenantContext;
  source: RuntimeControllerSource;
  metadata?: Record<string, unknown>;
};

/**
 * Listener callback invoked when runtime controller state changes
 * @typedef {Function} RuntimeControllerListener
 * @returns {void}
 */
export type RuntimeControllerListener = () => void;

type TenantInput = ResolvedTenantContext | KoduckFlowTenantConfig | null | undefined;

/**
 * Initialization options for KoduckFlowRuntimeController
 * @interface RuntimeControllerOptions
 * @property {KoduckFlowRuntime|null} [initialRuntime] - Initial runtime instance to use, or null for no runtime
 * @property {RuntimeEnvironmentKey} [initialEnvironment] - Initial environment key configuration
 * @property {TenantInput} [initialTenant] - Initial tenant configuration or context
 * @property {RuntimeControllerSource} [initialSource='controller'] - Source identifier for initial runtime
 * @property {Record<string,unknown>} [initialMetadata] - Initial metadata to attach to runtime state
 * @property {boolean} [disposePreviousOnSwitch=true] - Whether to dispose previous runtime when switching
 * @property {KoduckFlowRuntimeFactory} [factory] - Default factory for runtime creation and management
 */
export interface RuntimeControllerOptions {
  initialRuntime?: KoduckFlowRuntime | null;
  initialEnvironment?: RuntimeEnvironmentKey;
  initialTenant?: TenantInput;
  initialSource?: RuntimeControllerSource;
  initialMetadata?: Record<string, unknown>;
  disposePreviousOnSwitch?: boolean;
  factory?: KoduckFlowRuntimeFactory;
}

/**
 * Options for setRuntime method
 * @interface RuntimeSetOptions
 * @property {RuntimeEnvironmentKey} [environment] - Environment key to update
 * @property {TenantInput} [tenant] - Tenant context to apply
 * @property {boolean} [disposePrevious] - Override default disposal behavior
 * @property {RuntimeControllerSource} [source] - Source identifier for this operation
 * @property {Record<string,unknown>} [metadata] - Metadata to attach to runtime state
 */
export interface RuntimeSetOptions {
  environment?: RuntimeEnvironmentKey;
  tenant?: TenantInput;
  disposePrevious?: boolean;
  source?: RuntimeControllerSource;
  metadata?: Record<string, unknown>;
}

/**
 * Options for switchToEnvironment method
 * @interface RuntimeSwitchOptions
 * @property {KoduckFlowRuntimeFactory} [factory] - Factory to use for runtime creation (overrides default)
 * @property {RuntimeCreationOptions} [options] - Options to pass to runtime factory
 * @property {TenantInput} [tenant] - Tenant context for new runtime
 * @property {boolean} [disposePrevious=true] - Whether to dispose previous runtime
 * @property {boolean} [reuse=true] - Whether to reuse existing runtime for environment
 * @property {RuntimeControllerSource} [source] - Source identifier for this operation
 * @property {Record<string,unknown>} [metadata] - Metadata to attach to new runtime state
 */
export interface RuntimeSwitchOptions {
  factory?: KoduckFlowRuntimeFactory;
  options?: RuntimeCreationOptions;
  tenant?: TenantInput;
  disposePrevious?: boolean;
  reuse?: boolean;
  source?: RuntimeControllerSource;
  metadata?: Record<string, unknown>;
}

type SnapshotUpdate = {
  runtime?: KoduckFlowRuntime | null;
  environment?: RuntimeEnvironmentKey | null;
  tenant?: ResolvedTenantContext | null | undefined;
  source?: RuntimeControllerSource;
  metadata?: Record<string, unknown> | null | undefined;
};

/**
 * Runtime controller managing KoduckFlow runtime instances with multi-tenancy support
 * @class KoduckFlowRuntimeController
 * @description Provides centralized state management for runtime lifecycle, environment switching,
 * and tenant context handling. Supports listener subscription for state changes.
 * @example
 * ```typescript
 * const controller = new KoduckFlowRuntimeController({
 *   initialEnvironment: { environment: 'prod', tenantId: 'tenant-1' },
 *   factory: runtimeFactory,
 *   disposePreviousOnSwitch: true
 * });
 * controller.subscribe(() => console.log('Runtime updated'));
 * const runtime = controller.switchToEnvironment('prod', {
 *   options: { enableMetrics: true }
 * });
 * ```
 */
export class KoduckFlowRuntimeController {
  private snapshot: RuntimeControllerSnapshot;

  private readonly listeners = new Set<RuntimeControllerListener>();

  private readonly disposePreviousOnSwitch: boolean;

  private readonly defaultFactory: KoduckFlowRuntimeFactory | undefined;

  /**
   * Construct a new runtime controller
   * @param {RuntimeControllerOptions} [options={}] - Configuration for controller initialization
   * @example
   * ```typescript
   * const controller = new KoduckFlowRuntimeController({
   *   initialRuntime: existingRuntime,
   *   initialEnvironment: { environment: 'dev', tenantId: 'test' },
   *   disposePreviousOnSwitch: true
   * });
   * ```
   */
  constructor(options: RuntimeControllerOptions = {}) {
    this.disposePreviousOnSwitch = options.disposePreviousOnSwitch ?? true;
    this.defaultFactory = options.factory;

    const initialTenant = this.normalizeTenantInput(
      options.initialTenant,
      options.initialEnvironment,
      options.initialRuntime ?? null
    );

    if (options.initialRuntime && initialTenant !== undefined) {
      options.initialRuntime.setTenantContext(initialTenant ?? null);
    }

    const snapshot: RuntimeControllerSnapshot = {
      runtime: options.initialRuntime ?? null,
      source:
        options.initialSource ?? (options.initialRuntime ? "controller-external" : "controller"),
    };

    if (options.initialEnvironment) {
      snapshot.environment = options.initialEnvironment;
    }

    if (initialTenant) {
      const tenantClone = this.cloneTenant(initialTenant);
      if (tenantClone) {
        snapshot.tenant = tenantClone;
      }
    }

    if (options.initialMetadata) {
      snapshot.metadata = options.initialMetadata;
    }

    this.snapshot = snapshot;
  }

  /**
   * Get the current runtime controller state snapshot
   * @returns {RuntimeControllerSnapshot} Immutable snapshot of current state
   * @example
   * ```typescript
   * const snapshot = controller.getSnapshot();
   * console.log(snapshot.runtime, snapshot.environment, snapshot.tenant);
   * ```
   */
  getSnapshot = (): RuntimeControllerSnapshot => this.snapshot;

  /**
   * Subscribe to runtime controller state changes
   * @param {RuntimeControllerListener} listener - Callback invoked on state changes
   * @returns {Function} Unsubscribe function to remove listener
   * @example
   * ```typescript
   * const unsubscribe = controller.subscribe(() => {
   *   console.log('Runtime state changed');
   * });
   * // Later: unsubscribe();
   * ```
   */
  subscribe(listener: RuntimeControllerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get the current runtime instance
   * @returns {KoduckFlowRuntime|null} Current runtime or null if not initialized
   * @example
   * ```typescript
   * const runtime = controller.getRuntime();
   * if (runtime) {
   *   await runtime.execute(flow);
   * }
   * ```
   */
  getRuntime(): KoduckFlowRuntime | null {
    return this.snapshot.runtime;
  }

  /**
   * Get the current environment key configuration
   * @returns {RuntimeEnvironmentKey|undefined} Current environment or undefined
   * @example
   * ```typescript
   * const env = controller.getEnvironment();
   * console.log(env?.environment, env?.tenantId);
   * ```
   */
  getEnvironment(): RuntimeEnvironmentKey | undefined {
    return this.snapshot.environment;
  }

  /**
   * Set the runtime instance with optional environment and tenant configuration
   * @param {KoduckFlowRuntime|null} runtime - Runtime to set, or null to clear
   * @param {RuntimeSetOptions} [options={}] - Configuration options
   * @returns {KoduckFlowRuntime|null} The set runtime instance
   * @throws {Error} If runtime initialization fails
   * @example
   * ```typescript
   * const newRuntime = new KoduckFlowRuntime();
   * controller.setRuntime(newRuntime, {
   *   environment: { environment: 'prod', tenantId: 'tenant-1' },
   *   tenant: tenantConfig,
   *   disposePrevious: true,
   *   source: 'controller'
   * });
   * ```
   */
  setRuntime(
    runtime: KoduckFlowRuntime | null,
    options: RuntimeSetOptions = {}
  ): KoduckFlowRuntime | null {
    const previous = this.snapshot.runtime;
    const environment = options.environment ?? this.snapshot.environment;
    const source = options.source ?? "controller";
    const tenantUpdate = this.normalizeTenantInput(options.tenant, environment, runtime);

    const nextTenant = this.applyTenantToRuntime(runtime, tenantUpdate);

    const update: SnapshotUpdate = {
      runtime,
      source,
    };

    if (environment !== undefined) {
      update.environment = environment;
    }

    if (tenantUpdate !== undefined || runtime) {
      update.tenant = tenantUpdate !== undefined ? tenantUpdate : (nextTenant ?? null);
    }

    if (options.metadata !== undefined) {
      update.metadata = options.metadata;
    }

    this.commitSnapshot(update);

    if (previous && previous !== runtime) {
      const shouldDispose = options.disposePrevious ?? this.disposePreviousOnSwitch;
      if (shouldDispose) {
        try {
          previous.dispose();
        } catch (error) {
          logger.error("Failed to dispose previous KoduckFlow runtime", {
            error,
          });
        }
      }
    }

    return runtime;
  }

  /**
   * Switch to a different runtime environment, creating new runtime if needed
   * @param {RuntimeEnvironmentKey} key - Environment key to switch to
   * @param {RuntimeSwitchOptions} [options={}] - Switch configuration
   * @returns {KoduckFlowRuntime} The runtime for the switched environment
   * @throws {Error} If no factory provided or environment switch fails
   * @example
   * ```typescript
   * const runtime = controller.switchToEnvironment(
   *   { environment: 'staging', tenantId: 'tenant-2' },
   *   {
   *     options: { enableMetrics: true },
   *     disposePrevious: true,
   *     reuse: true,
   *     source: 'controller-factory'
   *   }
   * );
   * ```
   */
  switchToEnvironment(
    key: RuntimeEnvironmentKey,
    options: RuntimeSwitchOptions = {}
  ): KoduckFlowRuntime {
    const factory = options.factory ?? this.defaultFactory;
    if (!factory) {
      throw new Error(
        "KoduckFlowRuntimeController requires a factory to switch runtime by environment."
      );
    }

    if (options.reuse === false && factory.hasRuntime(key)) {
      factory.disposeRuntime(key);
    }

    const runtime = factory.getOrCreateRuntime(key, options.options);

    const setOptions: RuntimeSetOptions = {
      environment: key,
      source: options.source ?? "controller-factory",
    };

    if (options.tenant !== undefined) {
      setOptions.tenant = options.tenant;
    }

    if (options.metadata !== undefined) {
      setOptions.metadata = options.metadata;
    }

    if (options.disposePrevious !== undefined) {
      setOptions.disposePrevious = options.disposePrevious;
    }

    this.setRuntime(runtime, setOptions);

    return runtime;
  }

  /**
   * Clear the current runtime and optionally dispose it
   * @param {Object} [options={}] - Clear configuration
   * @param {boolean} [options.dispose=this.disposePreviousOnSwitch] - Whether to dispose runtime
   * @example
   * ```typescript
   * controller.clearRuntime({ dispose: true });
   * // controller.getRuntime() === null
   * ```
   */
  clearRuntime(options: { dispose?: boolean } = {}): void {
    const previous = this.snapshot.runtime;
    const shouldDispose = options.dispose ?? this.disposePreviousOnSwitch;

    this.commitSnapshot({
      runtime: null,
      tenant: null,
      environment: null,
      source: "controller",
      metadata: null,
    });

    if (previous && shouldDispose) {
      try {
        previous.dispose();
      } catch (error) {
        logger.error("Failed to dispose runtime while clearing controller", {
          error,
        });
      }
    }
  }

  /**
   * Set or update the tenant context for the current runtime
   * @param {TenantInput} tenant - Tenant configuration or context to apply
   * @param {RuntimeEnvironmentKey} [environment] - Optional environment to use for tenant resolution
   * @returns {ResolvedTenantContext|undefined} The resolved tenant context or undefined if failed
   * @throws {Error} If tenant resolution fails
   * @example
   * ```typescript
   * const tenantCtx = controller.setTenant({
   *   tenantId: 'tenant-2',
   *   environment: 'staging'
   * });
   * ```
   */
  setTenant(
    tenant: TenantInput,
    environment?: RuntimeEnvironmentKey
  ): ResolvedTenantContext | undefined {
    const runtime = this.snapshot.runtime;
    const envKey = environment ?? this.snapshot.environment;
    const normalizedTenant = this.normalizeTenantInput(tenant, envKey, runtime);

    const nextTenant = this.applyTenantToRuntime(runtime, normalizedTenant);
    const finalEnvironment = envKey ?? this.snapshot.environment;

    const update: SnapshotUpdate = {};

    if (normalizedTenant !== undefined || runtime) {
      update.tenant = normalizedTenant !== undefined ? normalizedTenant : (nextTenant ?? null);
    }

    if (finalEnvironment !== undefined) {
      update.environment = finalEnvironment;
    }

    this.commitSnapshot(update);

    return this.snapshot.tenant;
  }

  private applyTenantToRuntime(
    runtime: KoduckFlowRuntime | null,
    tenant: ResolvedTenantContext | null | undefined
  ): ResolvedTenantContext | null | undefined {
    if (!runtime) {
      if (tenant && tenant !== null) {
        return this.cloneTenant(tenant);
      }
      return undefined;
    }

    if (tenant !== undefined) {
      runtime.setTenantContext(tenant ?? null);
      return runtime.getTenantContext();
    }

    if (this.snapshot.tenant) {
      runtime.setTenantContext(this.snapshot.tenant);
      return runtime.getTenantContext();
    }

    return runtime.getTenantContext();
  }

  private normalizeTenantInput(
    tenant: TenantInput,
    environment: RuntimeEnvironmentKey | undefined,
    runtime: KoduckFlowRuntime | null
  ): ResolvedTenantContext | null | undefined {
    if (tenant === undefined) {
      return undefined;
    }

    if (tenant === null) {
      if (runtime) {
        runtime.setTenantContext(null);
      }
      return null;
    }

    if (isResolvedTenantContext(tenant)) {
      return this.cloneTenant(tenant);
    }

    const envKey: RuntimeEnvironmentKey | undefined = environment ?? {
      environment: tenant.environment ?? "default",
      tenantId: tenant.tenantId,
    };

    if (!envKey) {
      logger.warn("RuntimeController cannot resolve tenant context without environment", {
        tenantId: tenant.tenantId,
      });
      return undefined;
    }

    try {
      return resolveTenantContext(tenant, envKey);
    } catch (error) {
      logger.error("RuntimeController failed to resolve tenant context", {
        tenantId: tenant.tenantId,
        environment: envKey,
        error,
      });
      return undefined;
    }
  }

  private commitSnapshot(update: SnapshotUpdate): void {
    const next: RuntimeControllerSnapshot = {
      runtime: update.runtime !== undefined ? update.runtime : this.snapshot.runtime,
      source: update.source ?? this.snapshot.source,
    };

    const environment =
      update.environment !== undefined
        ? (update.environment ?? undefined)
        : this.snapshot.environment;

    if (environment !== undefined) {
      next.environment = environment;
    }

    const tenant =
      update.tenant !== undefined
        ? update.tenant === null
          ? undefined
          : this.cloneTenant(update.tenant)
        : this.snapshot.tenant;

    if (tenant !== undefined) {
      next.tenant = tenant;
    }

    const metadata =
      update.metadata !== undefined ? (update.metadata ?? undefined) : this.snapshot.metadata;

    if (metadata !== undefined) {
      next.metadata = metadata;
    }

    this.snapshot = next;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private cloneTenant(tenant: ResolvedTenantContext): ResolvedTenantContext;
  private cloneTenant(tenant: undefined): undefined;
  private cloneTenant(
    tenant: ResolvedTenantContext | undefined
  ): ResolvedTenantContext | undefined {
    if (!tenant) {
      return undefined;
    }

    const clone: ResolvedTenantContext = {
      tenantId: tenant.tenantId,
      environment: tenant.environment,
      environmentKey: { ...tenant.environmentKey },
      normalizedEnvironmentKey: tenant.normalizedEnvironmentKey,
    };

    if (tenant.displayName !== undefined) {
      clone.displayName = tenant.displayName;
    }

    if (tenant.metadata) {
      clone.metadata = { ...tenant.metadata };
    }

    if (tenant.quotas) {
      clone.quotas = cloneTenantQuotas(tenant.quotas);
    }

    if (tenant.rollout) {
      const { features, ...rest } = tenant.rollout;
      clone.rollout = {
        ...rest,
        ...(features ? { features: { ...features } } : {}),
      };
    }

    return clone;
  }
}

function cloneTenantQuotas(
  quotas: NonNullable<ResolvedTenantContext["quotas"]>
): NonNullable<ResolvedTenantContext["quotas"]> {
  const clone: NonNullable<ResolvedTenantContext["quotas"]> = { ...quotas };
  if (quotas.custom) {
    clone.custom = { ...quotas.custom };
  }
  return clone;
}

function isResolvedTenantContext(value: TenantInput): value is ResolvedTenantContext {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as ResolvedTenantContext).normalizedEnvironmentKey !== undefined
  );
}
