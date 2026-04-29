/**
 * @module src/components/provider/KoduckFlowProvider
 * @description React Context Provider for KoduckFlow runtime initialization and distribution.
 * Manages runtime lifecycle and makes it available to all child components via context.
 */

import React, { useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import {
  KoduckFlowRuntime,
  KoduckFlowRuntimeController,
  KoduckFlowRuntimeFactory,
  type KoduckFlowTenantConfig,
  type ResolvedTenantContext,
  type RuntimeCreationOptions,
  type RuntimeEnvironmentKey,
} from "../../common/runtime";
import { clearApiRuntime, setApiRuntime, type ApiRuntimeToken } from "../../common/api";
import type { KoduckFlowContextValue, KoduckFlowRuntimeSource } from "./context/KoduckFlowContext";
import { KoduckFlowContext } from "./context/KoduckFlowContext";
import type { DebugOptions, DebugPanelPosition } from "../../common/runtime/debug-options";
import { DebugPanel } from "../debug/DebugPanel";
import {
  type EnvironmentLike,
  resolveProviderEnvironment,
  resolveProviderTenantContext,
  useKoduckFlowRuntimeLifecycle,
} from "./useKoduckFlowRuntimeLifecycle";

/**
 * Props for provider-managed runtime creation
 */
type ManagedRuntimeProps = {
  runtime?: undefined;
  /**
   * Remount key for provider-managed runtime lifecycle.
   *
   * `environment`, `options`, `factory`, `reuse`, `lazy`, and `disposeOnUnmount`
   * are read when the unmanaged runtime is mounted. Change this key to recreate
   * the provider-owned runtime with new creation props.
   */
  lifecycleKey?: React.Key;
  environment?: EnvironmentLike;
  options?: RuntimeCreationOptions;
  factory?: KoduckFlowRuntimeFactory;
  reuse?: boolean;
  disposeOnUnmount?: boolean;
  lazy?: boolean;
  onDispose?: (runtime: KoduckFlowRuntime) => void;
};

/**
 * Props for externally-provided runtime
 */
type ExternalRuntimeProps = {
  runtime: KoduckFlowRuntime;
  /**
   * Remount key for uncontrolled provider lifecycle.
   *
   * The `runtime` prop is mount-only in uncontrolled mode. Change this key to
   * swap to a different externally-created runtime, or use `controller` for
   * hot-switching runtime instances.
   */
  lifecycleKey?: React.Key;
  environment?: EnvironmentLike;
  factory?: KoduckFlowRuntimeFactory;
  options?: RuntimeCreationOptions;
  reuse?: boolean;
  disposeOnUnmount?: boolean;
  lazy?: boolean;
  onDispose?: (runtime: KoduckFlowRuntime) => void;
};

type RuntimeSourceProps = ManagedRuntimeProps | ExternalRuntimeProps;

/**
 * Base props common to all KoduckFlowProvider configurations
 */
type KoduckFlowProviderBaseProps = {
  /** React child components */
  children: React.ReactNode;
  /** Callback invoked once after runtime initialization */
  onInit?: (runtime: KoduckFlowRuntime) => void;
  /** Callback invoked when tenant context is resolved */
  onTenantInit?: (runtime: KoduckFlowRuntime, tenant: ResolvedTenantContext) => void;
  /** Debug configuration for provider-scoped runtime */
  debugOptions?: DebugOptions;
  /** Tenant configuration for multi-tenant mode */
  tenant?: KoduckFlowTenantConfig;
};

/**
 * Uncontrolled provider props (runtime managed by provider)
 */
type UncontrolledKoduckFlowProviderProps = KoduckFlowProviderBaseProps &
  RuntimeSourceProps & { controller?: undefined };

/**
 * Controlled provider props (runtime managed externally)
 */
type ControlledKoduckFlowProviderProps = KoduckFlowProviderBaseProps & {
  controller: KoduckFlowRuntimeController;
  environment?: EnvironmentLike;
  fallback?: React.ReactNode;
};

/**
 * Props for KoduckFlowProvider component
 * Can be either controlled (via controller) or uncontrolled (via runtime creation)
 * @typedef {ControlledKoduckFlowProviderProps | UncontrolledKoduckFlowProviderProps} KoduckFlowProviderProps
 */
export type KoduckFlowProviderProps =
  | ControlledKoduckFlowProviderProps
  | UncontrolledKoduckFlowProviderProps;

type ProviderSharedStateParams = {
  runtime: KoduckFlowRuntime;
  factory?: KoduckFlowRuntimeFactory;
  source: KoduckFlowRuntimeSource;
  environment?: RuntimeEnvironmentKey;
  tenant?: ResolvedTenantContext;
  debugOptions?: DebugOptions;
};

type ProviderSharedState = {
  value: KoduckFlowContextValue;
  panelEnabled: boolean;
  panelDefaultOpen: boolean;
  panelPosition: DebugPanelPosition;
  eventTrackingEnabled: boolean;
};

/**
 * Creates shared state for the provider, managing API runtime token lifecycle
 * @param {ProviderSharedStateParams} params - Shared state parameters
 * @param {KoduckFlowRuntime} params.runtime - The runtime instance
 * @param {KoduckFlowRuntimeFactory} [params.factory] - Optional factory function
 * @param {KoduckFlowRuntimeSource} params.source - Source identifier
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

  const value = useMemo<KoduckFlowContextValue>(() => {
    const contextValue: KoduckFlowContextValue = {
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

const UncontrolledKoduckFlowProvider: React.FC<UncontrolledKoduckFlowProviderProps> = (props) => {
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

  const lifecycle = useKoduckFlowRuntimeLifecycle({
    ...(runtimeProp ? { runtime: runtimeProp } : {}),
    ...(environment !== undefined ? { environment } : {}),
    ...(options ? { options } : {}),
    ...(factory ? { factory } : {}),
    ...(reuse !== undefined ? { reuse } : {}),
    ...(disposeOnUnmount !== undefined ? { disposeOnUnmount } : {}),
    ...(lazy !== undefined ? { lazy } : {}),
    ...(onInit ? { onInit } : {}),
    ...(onDispose ? { onDispose } : {}),
    ...(onTenantInit ? { onTenantInit } : {}),
    ...(tenant ? { tenant } : {}),
  });

  const shared = useProviderSharedState({
    runtime: lifecycle.runtime,
    factory: lifecycle.factory,
    source: lifecycle.source,
    ...(lifecycle.environment !== undefined ? { environment: lifecycle.environment } : {}),
    ...(lifecycle.tenant ? { tenant: lifecycle.tenant } : {}),
    ...(debugOptions ? { debugOptions } : {}),
  });

  return (
    <KoduckFlowContext.Provider value={shared.value}>
      {children}
      {shared.panelEnabled ? (
        <DebugPanel
          defaultOpen={shared.panelDefaultOpen}
          position={shared.panelPosition}
          eventTracking={shared.eventTrackingEnabled}
        />
      ) : null}
    </KoduckFlowContext.Provider>
  );
};

const ControlledKoduckFlowProvider: React.FC<ControlledKoduckFlowProviderProps> = (props) => {
  const { controller, fallback } = props;

  const subscribe = useMemo(() => controller.subscribe.bind(controller), [controller]);
  const snapshot = useSyncExternalStore(subscribe, controller.getSnapshot, controller.getSnapshot);

  const runtime = snapshot.runtime;

  if (!runtime) {
    return <>{fallback ?? null}</>;
  }

  return <ControlledKoduckFlowRuntimeProvider {...props} runtime={runtime} snapshot={snapshot} />;
};

type ControlledKoduckFlowRuntimeProviderProps = ControlledKoduckFlowProviderProps & {
  runtime: KoduckFlowRuntime;
  snapshot: ReturnType<KoduckFlowRuntimeController["getSnapshot"]>;
};

const ControlledKoduckFlowRuntimeProvider: React.FC<ControlledKoduckFlowRuntimeProviderProps> = ({
  runtime,
  snapshot,
  children,
  onInit,
  onTenantInit,
  debugOptions,
  tenant,
  environment,
}) => {
  const normalizedEnvironmentFromProps = useMemo<RuntimeEnvironmentKey | undefined>(() => {
    return resolveProviderEnvironment(environment, tenant, "controlled");
  }, [environment, tenant]);

  const resolvedTenantFromProps = useMemo<ResolvedTenantContext | undefined>(() => {
    return resolveProviderTenantContext(tenant, normalizedEnvironmentFromProps, "controlled");
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

  const initializedRuntimeRef = useRef<KoduckFlowRuntime | null>(null);
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
    <KoduckFlowContext.Provider value={shared.value}>
      {children}
      {shared.panelEnabled ? (
        <DebugPanel
          defaultOpen={shared.panelDefaultOpen}
          position={shared.panelPosition}
          eventTracking={shared.eventTrackingEnabled}
        />
      ) : null}
    </KoduckFlowContext.Provider>
  );
};

export const KoduckFlowProvider: React.FC<KoduckFlowProviderProps> = (props) => {
  if ("controller" in props && props.controller) {
    return <ControlledKoduckFlowProvider {...(props)} />;
  }
  const uncontrolledProps = props;
  return (
    <UncontrolledKoduckFlowProvider
      key={uncontrolledProps.lifecycleKey}
      {...uncontrolledProps}
    />
  );
};
