/**
 * @module src/components/provider/DuckFlowProvider
 * @description React Context Provider for DuckFlow runtime initialization and distribution.
 * Manages runtime lifecycle and makes it available to all child components via context.
 */

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  DuckFlowRuntime,
  DuckFlowRuntimeController,
  DuckFlowRuntimeFactory,
  createDuckFlowRuntime,
  resolveTenantContext,
  type DuckFlowTenantConfig,
  type ResolvedTenantContext,
  type RuntimeCreationOptions,
  type RuntimeEnvironmentKey,
} from "../../common/runtime";
import { DEFAULT_DUCKFLOW_ENVIRONMENT, getRuntimeForKey } from "../../common/global-runtime";
import { clearApiRuntime, setApiRuntime, type ApiRuntimeToken } from "../../common/api";
import { logger } from "../../common/logger";
import type { DuckFlowContextValue, DuckFlowRuntimeSource } from "./context/DuckFlowContext";
import { DuckFlowContext } from "./context/DuckFlowContext";
import type { DebugOptions, DebugPanelPosition } from "../../common/runtime/debug-options";
import { DebugPanel } from "../debug/DebugPanel";

/**
 * Environment configuration compatible with RuntimeEnvironmentKey
 */
type EnvironmentLike = RuntimeEnvironmentKey | string | undefined;

/**
 * Converts environment-like value to normalized RuntimeEnvironmentKey
 * @param {EnvironmentLike} value - Value to normalize
 * @returns {RuntimeEnvironmentKey | undefined} Normalized environment key
 */
const toEnvironmentKey = (value: EnvironmentLike): RuntimeEnvironmentKey | undefined => {
  if (!value) return undefined;
  return typeof value === "string" ? { environment: value } : value;
};

const defaultRuntimeFactory = new DuckFlowRuntimeFactory();

/**
 * Props for provider-managed runtime creation
 */
type ManagedRuntimeProps = {
  runtime?: undefined;
  environment?: EnvironmentLike;
  options?: RuntimeCreationOptions;
  factory?: DuckFlowRuntimeFactory;
  reuse?: boolean;
  disposeOnUnmount?: boolean;
  lazy?: boolean;
  onDispose?: (runtime: DuckFlowRuntime) => void;
};

/**
 * Props for externally-provided runtime
 */
type ExternalRuntimeProps = {
  runtime: DuckFlowRuntime;
  environment?: EnvironmentLike;
  factory?: DuckFlowRuntimeFactory;
  options?: RuntimeCreationOptions;
  reuse?: boolean;
  disposeOnUnmount?: boolean;
  lazy?: boolean;
  onDispose?: (runtime: DuckFlowRuntime) => void;
};

type RuntimeSourceProps = ManagedRuntimeProps | ExternalRuntimeProps;

/**
 * Base props common to all DuckFlowProvider configurations
 */
type DuckFlowProviderBaseProps = {
  /** React child components */
  children: React.ReactNode;
  /** Callback invoked once after runtime initialization */
  onInit?: (runtime: DuckFlowRuntime) => void;
  /** Callback invoked when tenant context is resolved */
  onTenantInit?: (runtime: DuckFlowRuntime, tenant: ResolvedTenantContext) => void;
  /** Debug configuration for provider-scoped runtime */
  debugOptions?: DebugOptions;
  /** Tenant configuration for multi-tenant mode */
  tenant?: DuckFlowTenantConfig;
};

/**
 * Uncontrolled provider props (runtime managed by provider)
 */
type UncontrolledDuckFlowProviderProps = DuckFlowProviderBaseProps &
  RuntimeSourceProps & { controller?: undefined };

/**
 * Controlled provider props (runtime managed externally)
 */
type ControlledDuckFlowProviderProps = DuckFlowProviderBaseProps & {
  controller: DuckFlowRuntimeController;
  environment?: EnvironmentLike;
};

/**
 * Props for DuckFlowProvider component
 * Can be either controlled (via controller) or uncontrolled (via runtime creation)
 * @typedef {ControlledDuckFlowProviderProps | UncontrolledDuckFlowProviderProps} DuckFlowProviderProps
 */
export type DuckFlowProviderProps =
  | ControlledDuckFlowProviderProps
  | UncontrolledDuckFlowProviderProps;

type ProviderSharedStateParams = {
  runtime: DuckFlowRuntime;
  factory?: DuckFlowRuntimeFactory;
  source: DuckFlowRuntimeSource;
  environment?: RuntimeEnvironmentKey;
  tenant?: ResolvedTenantContext;
  debugOptions?: DebugOptions;
};

type ProviderSharedState = {
  value: DuckFlowContextValue;
  panelEnabled: boolean;
  panelDefaultOpen: boolean;
  panelPosition: DebugPanelPosition;
  eventTrackingEnabled: boolean;
};

/**
 * Creates shared state for the provider, managing API runtime token lifecycle
 * @param {ProviderSharedStateParams} params - Shared state parameters
 * @param {DuckFlowRuntime} params.runtime - The runtime instance
 * @param {DuckFlowRuntimeFactory} [params.factory] - Optional factory function
 * @param {DuckFlowRuntimeSource} params.source - Source identifier
 * @param {RuntimeEnvironmentKey} [params.environment] - Environment configuration
 * @param {ResolvedTenantContext} [params.tenant] - Tenant context
 * @param {DebugOptions} [params.debugOptions] - Debug configuration
 * @returns {ProviderSharedState} Shared state object
 */
const useProviderSharedState = ({
  runtime,
  factory,
  source,
  environment,
  tenant,
  debugOptions,
}: ProviderSharedStateParams): ProviderSharedState => {
  const apiRuntimeTokenRef = useRef<ApiRuntimeToken | null>(null);

  useEffect(() => {
    const token = setApiRuntime(runtime, {
      source,
      environment,
      tenantId: tenant?.tenantId,
      tenant,
    });
    apiRuntimeTokenRef.current = token;

    return () => {
      if (token) {
        clearApiRuntime(token);
        if (apiRuntimeTokenRef.current === token) {
          apiRuntimeTokenRef.current = null;
        }
      }
    };
  }, [environment, runtime, source, tenant]);

  useEffect(() => {
    runtime.configureDebug(debugOptions);
  }, [runtime, debugOptions]);

  const value = useMemo<DuckFlowContextValue>(() => {
    const contextValue: DuckFlowContextValue = {
      runtime,
      source,
    };

    if (factory) {
      contextValue.factory = factory;
    }

    if (environment !== undefined) {
      contextValue.environment = environment;
    }

    if (tenant) {
      contextValue.tenant = tenant;
    }

    return contextValue;
  }, [environment, factory, runtime, source, tenant]);

  const panelEnabled = useMemo(() => {
    if (!debugOptions) return false;
    if (debugOptions.panel?.enabled !== undefined) {
      return debugOptions.panel.enabled;
    }
    return Boolean(debugOptions.enabled);
  }, [debugOptions]);

  const panelDefaultOpen = debugOptions?.panel?.defaultOpen ?? false;
  const panelPosition = debugOptions?.panel?.position ?? "right";
  const eventTrackingEnabled = Boolean(debugOptions?.eventTracking);

  return {
    value,
    panelEnabled,
    panelDefaultOpen,
    panelPosition,
    eventTrackingEnabled,
  };
};

const UncontrolledDuckFlowProvider: React.FC<UncontrolledDuckFlowProviderProps> = (props) => {
  const {
    children,
    onInit,
    onTenantInit,
    environment,
    options,
    runtime: runtimeProp,
    factory,
    reuse,
    disposeOnUnmount,
    lazy,
    onDispose,
    debugOptions,
    tenant,
  } = props;

  const normalizedEnvironment = useMemo<RuntimeEnvironmentKey | undefined>(() => {
    const base = toEnvironmentKey(environment);
    if (!tenant) {
      return base;
    }

    const tenantId = tenant.tenantId?.trim();
    if (!tenantId) {
      logger.warn(
        "DuckFlowProvider received tenant configuration without tenantId; tenant context will be ignored."
      );
      return base;
    }

    if (base) {
      if (base.tenantId && base.tenantId !== tenantId) {
        logger.warn(
          "DuckFlowProvider tenantId mismatch between environment prop and tenant config. Using tenant configuration value.",
          {
            environmentTenant: base.tenantId,
            tenantId,
          }
        );
      }
      return {
        ...base,
        tenantId,
      } satisfies RuntimeEnvironmentKey;
    }

    const fallbackEnvironment = tenant.environment ?? DEFAULT_DUCKFLOW_ENVIRONMENT;
    logger.debug("DuckFlowProvider inferred environment for tenant", {
      tenantId,
      environment: fallbackEnvironment,
    });
    return {
      environment: fallbackEnvironment,
      tenantId,
    } satisfies RuntimeEnvironmentKey;
  }, [environment, tenant]);

  const resolvedTenant = useMemo<ResolvedTenantContext | undefined>(() => {
    if (!tenant) {
      return undefined;
    }
    const environmentKey = normalizedEnvironment ?? {
      environment: tenant.environment ?? DEFAULT_DUCKFLOW_ENVIRONMENT,
      tenantId: tenant.tenantId,
    };
    try {
      return resolveTenantContext(tenant, environmentKey);
    } catch (error) {
      logger.error("DuckFlowProvider failed to resolve tenant context", {
        error,
        tenantId: tenant.tenantId,
        environmentKey,
      });
      return undefined;
    }
  }, [tenant, normalizedEnvironment]);

  const runtimeOptions = useMemo<RuntimeCreationOptions | undefined>(() => {
    if (!resolvedTenant) {
      return options;
    }
    const tenantMetadata = {
      tenantId: resolvedTenant.tenantId,
      tenantDisplayName: resolvedTenant.displayName,
      tenantEnvironment: resolvedTenant.environment,
      tenantNormalizedKey: resolvedTenant.normalizedEnvironmentKey,
      tenantQuotas: resolvedTenant.quotas,
      tenantRollout: resolvedTenant.rollout,
      tenantMetadata: resolvedTenant.metadata,
    };

    if (!options) {
      return {
        metadata: tenantMetadata,
      } satisfies RuntimeCreationOptions;
    }

    return {
      ...options,
      metadata: {
        ...options.metadata,
        ...tenantMetadata,
      },
    } satisfies RuntimeCreationOptions;
  }, [options, resolvedTenant]);

  const runtimeSourceRef = useRef<DuckFlowRuntimeSource>(
    runtimeProp ? "prop" : normalizedEnvironment ? "factory" : "local"
  );
  const normalizedFactory = factory ?? defaultRuntimeFactory;
  const reuseRuntime = reuse ?? true;
  const isLazyRuntime = lazy ?? false;
  const runtimeEnvironmentRef = useRef<RuntimeEnvironmentKey | undefined>(normalizedEnvironment);
  const createdViaFactoryRef = useRef(false);
  const usedGlobalRuntimeRef = useRef(false);
  const tenantInitKeyRef = useRef<string | undefined>(resolvedTenant?.normalizedEnvironmentKey);
  const initialTenantRef = useRef<string | undefined>(resolvedTenant?.tenantId);

  const wasRuntimePropProvided = useRef(Boolean(runtimeProp));
  const [runtime] = useState<DuckFlowRuntime>(() => {
    let instance: DuckFlowRuntime;

    if (runtimeProp) {
      runtimeEnvironmentRef.current = normalizedEnvironment;
      createdViaFactoryRef.current = false;
      runtimeSourceRef.current = "prop";
      instance = runtimeProp;
    } else {
      const envKey = normalizedEnvironment;
      if (envKey) {
        if (!factory) {
          instance = getRuntimeForKey(envKey, runtimeOptions);
          runtimeEnvironmentRef.current = envKey;
          createdViaFactoryRef.current = false;
          runtimeSourceRef.current = "global";
          usedGlobalRuntimeRef.current = true;
          logger.debug("DuckFlowProvider reusing global runtime instance", {
            environment: envKey.environment,
            tenantId: envKey.tenantId,
          });
        } else {
          if (!reuseRuntime && normalizedFactory.hasRuntime(envKey)) {
            normalizedFactory.disposeRuntime(envKey);
          }
          instance = normalizedFactory.getOrCreateRuntime(envKey, runtimeOptions);
          runtimeEnvironmentRef.current = envKey;
          createdViaFactoryRef.current = true;
          runtimeSourceRef.current = "factory";
          logger.debug("DuckFlowProvider acquired runtime from factory", {
            environment: envKey,
            reuse: reuseRuntime,
            lazy: isLazyRuntime,
            source: runtimeSourceRef.current,
          });
        }
      } else {
        instance = createDuckFlowRuntime(runtimeOptions);
        runtimeEnvironmentRef.current = undefined;
        createdViaFactoryRef.current = false;
        runtimeSourceRef.current = "local";
        logger.debug("DuckFlowProvider created new runtime instance", {
          lazy: isLazyRuntime,
          source: runtimeSourceRef.current,
        });
        if (isLazyRuntime) {
          logger.debug("DuckFlowProvider lazily prepared local runtime instance");
        }
      }
    }

    instance.setTenantContext(resolvedTenant ?? null);
    return instance;
  });

  useEffect(() => {
    if (runtimeProp && runtimeProp !== runtime) {
      logger.warn(
        "DuckFlowProvider does not support changing the runtime prop after mount. The initial instance will be used."
      );
    }
  }, [runtimeProp, runtime]);

  const didCallInit = useRef(false);
  const initialEnvironmentRef = useRef(normalizedEnvironment);
  const initialFactoryRef = useRef(factory);
  useEffect(() => {
    const shouldDispose =
      (disposeOnUnmount ?? (!wasRuntimePropProvided.current && !reuseRuntime)) &&
      !usedGlobalRuntimeRef.current;
    if (didCallInit.current) {
      return;
    }
    didCallInit.current = true;
    onInit?.(runtime);

    return () => {
      // 🔧 在 React Strict Mode 下，允许重新初始化
      didCallInit.current = false;

      if (shouldDispose) {
        const envKey = runtimeEnvironmentRef.current;
        if (createdViaFactoryRef.current && envKey) {
          normalizedFactory.disposeRuntime(envKey);
          logger.debug("DuckFlowProvider disposed factory-managed runtime instance", {
            ...envKey,
            lazy: isLazyRuntime,
            source: runtimeSourceRef.current,
          });
        } else {
          runtime.dispose();
          logger.debug("DuckFlowProvider disposed managed runtime instance", {
            lazy: isLazyRuntime,
            source: runtimeSourceRef.current,
          });
        }
        onDispose?.(runtime);
      }
    };
  }, [
    disposeOnUnmount,
    normalizedFactory,
    onDispose,
    onInit,
    reuseRuntime,
    runtime,
    isLazyRuntime,
  ]);

  useEffect(() => {
    if (runtimeProp) return;

    const initial = initialEnvironmentRef.current;
    const nextTenant = resolvedTenant?.tenantId ?? normalizedEnvironment?.tenantId;

    if (!initial && normalizedEnvironment) {
      logger.warn("DuckFlowProvider does not support adding an environment prop after mount.");
      initialEnvironmentRef.current = normalizedEnvironment;
      if (nextTenant) {
        initialTenantRef.current = nextTenant;
      }
      return;
    }

    if (initial && normalizedEnvironment) {
      const initialTenant = initialTenantRef.current;
      if (nextTenant && initialTenant !== nextTenant) {
        initialEnvironmentRef.current = normalizedEnvironment;
        initialTenantRef.current = nextTenant;
        logger.info("DuckFlowProvider switched tenant context", {
          previousTenantId: initialTenant,
          tenantId: nextTenant,
        });
        return;
      }

      if (
        initial.environment !== normalizedEnvironment.environment ||
        initial.tenantId !== normalizedEnvironment.tenantId
      ) {
        logger.warn("DuckFlowProvider does not support changing the environment prop after mount.");
        initialEnvironmentRef.current = normalizedEnvironment;
        if (nextTenant) {
          initialTenantRef.current = nextTenant;
        }
      }
    }
  }, [normalizedEnvironment, runtimeProp, resolvedTenant]);

  useEffect(() => {
    runtimeEnvironmentRef.current = normalizedEnvironment;
  }, [normalizedEnvironment]);

  useEffect(() => {
    if (runtimeProp) return;

    if (!initialFactoryRef.current && factory) {
      logger.warn("DuckFlowProvider does not support adding a factory prop after mount.");
      initialFactoryRef.current = factory;
      return;
    }

    if (initialFactoryRef.current && factory && factory !== initialFactoryRef.current) {
      logger.warn("DuckFlowProvider does not support changing the factory prop after mount.");
      initialFactoryRef.current = factory;
    }
  }, [factory, runtimeProp]);

  useEffect(() => {
    if (initialTenantRef.current === undefined && resolvedTenant?.tenantId) {
      initialTenantRef.current = resolvedTenant.tenantId;
    }
  }, [resolvedTenant]);

  useEffect(() => {
    runtime.setTenantContext(resolvedTenant ?? null);
  }, [runtime, resolvedTenant]);

  useEffect(() => {
    if (!resolvedTenant || !onTenantInit) {
      return;
    }
    const key = resolvedTenant.normalizedEnvironmentKey;
    if (tenantInitKeyRef.current === key) {
      return;
    }
    tenantInitKeyRef.current = key;
    onTenantInit(runtime, resolvedTenant);
  }, [resolvedTenant, onTenantInit, runtime]);

  useEffect(() => {
    if (!resolvedTenant) {
      tenantInitKeyRef.current = undefined;
    }
  }, [resolvedTenant]);

  const runtimeEnvironment = runtimeEnvironmentRef.current;
  const runtimeSource = runtimeSourceRef.current;
  const shared = useProviderSharedState({
    runtime,
    factory: normalizedFactory,
    source: runtimeSource,
    ...(runtimeEnvironment !== undefined ? { environment: runtimeEnvironment } : {}),
    ...(resolvedTenant ? { tenant: resolvedTenant } : {}),
    ...(debugOptions ? { debugOptions } : {}),
  });

  return (
    <DuckFlowContext.Provider value={shared.value}>
      {children}
      {shared.panelEnabled ? (
        <DebugPanel
          defaultOpen={shared.panelDefaultOpen}
          position={shared.panelPosition}
          eventTracking={shared.eventTrackingEnabled}
        />
      ) : null}
    </DuckFlowContext.Provider>
  );
};

const ControlledDuckFlowProvider: React.FC<ControlledDuckFlowProviderProps> = (props) => {
  const { controller, children, onInit, onTenantInit, debugOptions, tenant, environment } = props;

  const subscribe = useMemo(() => controller.subscribe.bind(controller), [controller]);
  const snapshot = useSyncExternalStore(subscribe, controller.getSnapshot, controller.getSnapshot);

  const runtime = snapshot.runtime;

  if (!runtime) {
    throw new Error(
      "DuckFlowProvider (controlled) requires the controller to supply an active runtime instance."
    );
  }

  const normalizedEnvironmentFromProps = useMemo<RuntimeEnvironmentKey | undefined>(() => {
    const base = toEnvironmentKey(environment);
    if (!tenant) {
      return base;
    }

    const tenantId = tenant.tenantId?.trim();
    if (!tenantId) {
      logger.warn(
        "DuckFlowProvider (controlled) received tenant configuration without tenantId; tenant context will be ignored."
      );
      return base;
    }

    if (base) {
      if (base.tenantId && base.tenantId !== tenantId) {
        logger.warn(
          "DuckFlowProvider (controlled) tenantId mismatch between environment prop and tenant config. Using tenant configuration value.",
          {
            environmentTenant: base.tenantId,
            tenantId,
          }
        );
      }
      return {
        ...base,
        tenantId,
      } satisfies RuntimeEnvironmentKey;
    }

    const fallbackEnvironment = tenant.environment ?? DEFAULT_DUCKFLOW_ENVIRONMENT;
    logger.debug("DuckFlowProvider (controlled) inferred environment for tenant", {
      tenantId,
      environment: fallbackEnvironment,
    });
    return {
      environment: fallbackEnvironment,
      tenantId,
    } satisfies RuntimeEnvironmentKey;
  }, [environment, tenant]);

  const resolvedTenantFromProps = useMemo<ResolvedTenantContext | undefined>(() => {
    if (!tenant) {
      return undefined;
    }
    const environmentKey = normalizedEnvironmentFromProps ?? {
      environment: tenant.environment ?? DEFAULT_DUCKFLOW_ENVIRONMENT,
      tenantId: tenant.tenantId,
    };

    try {
      return resolveTenantContext(tenant, environmentKey);
    } catch (error) {
      logger.error("DuckFlowProvider (controlled) failed to resolve tenant context", {
        error,
        tenantId: tenant.tenantId,
        environmentKey,
      });
      return undefined;
    }
  }, [tenant, normalizedEnvironmentFromProps]);

  const controllerTenant = snapshot.tenant;
  const activeTenant = controllerTenant ?? resolvedTenantFromProps;
  const controllerEnvironment = snapshot.environment;
  const runtimeEnvironment = controllerEnvironment ?? normalizedEnvironmentFromProps;
  const runtimeSource = snapshot.source ?? "controller";

  useEffect(() => {
    if (controllerTenant !== undefined) {
      return;
    }
    if (!resolvedTenantFromProps) {
      return;
    }
    runtime.setTenantContext(resolvedTenantFromProps);
  }, [controllerTenant, resolvedTenantFromProps, runtime]);

  const initializedRuntimeRef = useRef<DuckFlowRuntime | null>(null);
  useEffect(() => {
    if (initializedRuntimeRef.current === runtime) {
      return;
    }
    onInit?.(runtime);
    initializedRuntimeRef.current = runtime;

    return () => {
      if (initializedRuntimeRef.current === runtime) {
        initializedRuntimeRef.current = null;
      }
    };
  }, [runtime, onInit]);

  const tenantInitKeyRef = useRef<string | undefined>(activeTenant?.normalizedEnvironmentKey);
  useEffect(() => {
    if (!activeTenant || !onTenantInit) {
      return;
    }
    const key = activeTenant.normalizedEnvironmentKey;
    if (tenantInitKeyRef.current === key) {
      return;
    }
    tenantInitKeyRef.current = key;
    onTenantInit(runtime, activeTenant);
  }, [activeTenant, onTenantInit, runtime]);

  useEffect(() => {
    if (!activeTenant) {
      tenantInitKeyRef.current = undefined;
    }
  }, [activeTenant]);

  const shared = useProviderSharedState({
    runtime,
    source: runtimeSource,
    ...(runtimeEnvironment !== undefined ? { environment: runtimeEnvironment } : {}),
    ...(activeTenant ? { tenant: activeTenant } : {}),
    ...(debugOptions ? { debugOptions } : {}),
  });

  return (
    <DuckFlowContext.Provider value={shared.value}>
      {children}
      {shared.panelEnabled ? (
        <DebugPanel
          defaultOpen={shared.panelDefaultOpen}
          position={shared.panelPosition}
          eventTracking={shared.eventTrackingEnabled}
        />
      ) : null}
    </DuckFlowContext.Provider>
  );
};

export const DuckFlowProvider: React.FC<DuckFlowProviderProps> = (props) => {
  if ("controller" in props && props.controller) {
    return <ControlledDuckFlowProvider {...(props as ControlledDuckFlowProviderProps)} />;
  }
  return <UncontrolledDuckFlowProvider {...(props as UncontrolledDuckFlowProviderProps)} />;
};
