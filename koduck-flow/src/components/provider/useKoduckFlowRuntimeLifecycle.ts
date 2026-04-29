import { useEffect, useMemo, useRef, useState } from "react";

import { DEFAULT_KODUCKFLOW_ENVIRONMENT, getRuntimeForKey } from "../../common/global-runtime";
import { logger } from "../../common/logger";
import {
  KoduckFlowRuntime,
  KoduckFlowRuntimeFactory,
  createKoduckFlowRuntime,
  resolveTenantContext,
  type KoduckFlowTenantConfig,
  type ResolvedTenantContext,
  type RuntimeCreationOptions,
  type RuntimeEnvironmentKey,
} from "../../common/runtime";
import type { KoduckFlowRuntimeSource } from "./context/KoduckFlowContext";

export type EnvironmentLike = RuntimeEnvironmentKey | string | undefined;

type ProviderMode = "controlled" | "uncontrolled";

const defaultRuntimeFactory = new KoduckFlowRuntimeFactory();

export const toEnvironmentKey = (value: EnvironmentLike): RuntimeEnvironmentKey | undefined => {
  if (!value) return undefined;
  return typeof value === "string" ? { environment: value } : value;
};

export const resolveProviderEnvironment = (
  environment: EnvironmentLike,
  tenant: KoduckFlowTenantConfig | undefined,
  mode: ProviderMode
): RuntimeEnvironmentKey | undefined => {
  const base = toEnvironmentKey(environment);
  const label = mode === "controlled" ? "KoduckFlowProvider (controlled)" : "KoduckFlowProvider";

  if (!tenant) {
    return base;
  }

  const tenantId = tenant.tenantId?.trim();
  if (!tenantId) {
    logger.warn(
      `${label} received tenant configuration without tenantId; tenant context will be ignored.`
    );
    return base;
  }

  if (base) {
    if (base.tenantId && base.tenantId !== tenantId) {
      logger.warn(
        `${label} tenantId mismatch between environment prop and tenant config. Using tenant configuration value.`,
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

  const fallbackEnvironment = tenant.environment ?? DEFAULT_KODUCKFLOW_ENVIRONMENT;
  logger.debug(`${label} inferred environment for tenant`, {
    tenantId,
    environment: fallbackEnvironment,
  });
  return {
    environment: fallbackEnvironment,
    tenantId,
  } satisfies RuntimeEnvironmentKey;
};

export const resolveProviderTenantContext = (
  tenant: KoduckFlowTenantConfig | undefined,
  environment: RuntimeEnvironmentKey | undefined,
  mode: ProviderMode
): ResolvedTenantContext | undefined => {
  if (!tenant) {
    return undefined;
  }

  const environmentKey =
    environment ??
    ({
      environment: tenant.environment ?? DEFAULT_KODUCKFLOW_ENVIRONMENT,
      tenantId: tenant.tenantId,
    } satisfies RuntimeEnvironmentKey);
  const label = mode === "controlled" ? "KoduckFlowProvider (controlled)" : "KoduckFlowProvider";

  try {
    return resolveTenantContext(tenant, environmentKey);
  } catch (error) {
    logger.error(`${label} failed to resolve tenant context`, {
      error,
      tenantId: tenant.tenantId,
      environmentKey,
    });
    return undefined;
  }
};

type UseKoduckFlowRuntimeLifecycleOptions = {
  runtime?: KoduckFlowRuntime;
  environment?: EnvironmentLike;
  options?: RuntimeCreationOptions;
  factory?: KoduckFlowRuntimeFactory;
  reuse?: boolean;
  disposeOnUnmount?: boolean;
  lazy?: boolean;
  onInit?: (runtime: KoduckFlowRuntime) => void;
  onDispose?: (runtime: KoduckFlowRuntime) => void;
  onTenantInit?: (runtime: KoduckFlowRuntime, tenant: ResolvedTenantContext) => void;
  tenant?: KoduckFlowTenantConfig;
};

type KoduckFlowRuntimeLifecycle = {
  runtime: KoduckFlowRuntime;
  factory: KoduckFlowRuntimeFactory;
  source: KoduckFlowRuntimeSource;
  environment?: RuntimeEnvironmentKey;
  tenant?: ResolvedTenantContext;
};

const withTenantMetadata = (
  options: RuntimeCreationOptions | undefined,
  tenant: ResolvedTenantContext | undefined
): RuntimeCreationOptions | undefined => {
  if (!tenant) {
    return options;
  }

  const tenantMetadata = {
    tenantId: tenant.tenantId,
    tenantDisplayName: tenant.displayName,
    tenantEnvironment: tenant.environment,
    tenantNormalizedKey: tenant.normalizedEnvironmentKey,
    tenantQuotas: tenant.quotas,
    tenantRollout: tenant.rollout,
    tenantMetadata: tenant.metadata,
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
};

export const useKoduckFlowRuntimeLifecycle = ({
  runtime: runtimeProp,
  environment,
  options,
  factory,
  reuse,
  disposeOnUnmount,
  lazy,
  onInit,
  onDispose,
  onTenantInit,
  tenant,
}: UseKoduckFlowRuntimeLifecycleOptions): KoduckFlowRuntimeLifecycle => {
  const normalizedEnvironment = useMemo(
    () => resolveProviderEnvironment(environment, tenant, "uncontrolled"),
    [environment, tenant]
  );

  const resolvedTenant = useMemo(
    () => resolveProviderTenantContext(tenant, normalizedEnvironment, "uncontrolled"),
    [tenant, normalizedEnvironment]
  );

  const runtimeOptions = useMemo(
    () => withTenantMetadata(options, resolvedTenant),
    [options, resolvedTenant]
  );

  const runtimeSourceRef = useRef<KoduckFlowRuntimeSource>(
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

  const [runtime] = useState<KoduckFlowRuntime>(() => {
    let instance: KoduckFlowRuntime;

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
          logger.debug("KoduckFlowProvider reusing global runtime instance", {
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
          logger.debug("KoduckFlowProvider acquired runtime from factory", {
            environment: envKey,
            reuse: reuseRuntime,
            lazy: isLazyRuntime,
            source: runtimeSourceRef.current,
          });
        }
      } else {
        instance = createKoduckFlowRuntime(runtimeOptions);
        runtimeEnvironmentRef.current = undefined;
        createdViaFactoryRef.current = false;
        runtimeSourceRef.current = "local";
        logger.debug("KoduckFlowProvider created new runtime instance", {
          lazy: isLazyRuntime,
          source: runtimeSourceRef.current,
        });
        if (isLazyRuntime) {
          logger.debug("KoduckFlowProvider lazily prepared local runtime instance");
        }
      }
    }

    instance.setTenantContext(resolvedTenant ?? null);
    return instance;
  });

  useEffect(() => {
    if (runtimeProp && runtimeProp !== runtime) {
      logger.warn(
        "KoduckFlowProvider does not support changing the runtime prop after mount. The initial instance will be used."
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
      didCallInit.current = false;

      if (shouldDispose) {
        const envKey = runtimeEnvironmentRef.current;
        if (createdViaFactoryRef.current && envKey) {
          normalizedFactory.disposeRuntime(envKey);
          logger.debug("KoduckFlowProvider disposed factory-managed runtime instance", {
            ...envKey,
            lazy: isLazyRuntime,
            source: runtimeSourceRef.current,
          });
        } else {
          runtime.dispose();
          logger.debug("KoduckFlowProvider disposed managed runtime instance", {
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
      logger.warn("KoduckFlowProvider does not support adding an environment prop after mount.");
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
        logger.info("KoduckFlowProvider switched tenant context", {
          previousTenantId: initialTenant,
          tenantId: nextTenant,
        });
        return;
      }

      if (
        initial.environment !== normalizedEnvironment.environment ||
        initial.tenantId !== normalizedEnvironment.tenantId
      ) {
        logger.warn(
          "KoduckFlowProvider does not support changing the environment prop after mount."
        );
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
      logger.warn("KoduckFlowProvider does not support adding a factory prop after mount.");
      initialFactoryRef.current = factory;
      return;
    }

    if (initialFactoryRef.current && factory && factory !== initialFactoryRef.current) {
      logger.warn("KoduckFlowProvider does not support changing the factory prop after mount.");
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

  return {
    runtime,
    factory: normalizedFactory,
    source: runtimeSourceRef.current,
    ...(runtimeEnvironmentRef.current !== undefined
      ? { environment: runtimeEnvironmentRef.current }
      : {}),
    ...(resolvedTenant ? { tenant: resolvedTenant } : {}),
  };
};
