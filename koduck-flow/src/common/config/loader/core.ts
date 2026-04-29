import { logger } from "../../logger";
import type { KoduckFlowConfig, ValidationResult } from "../schema";
import type { IConfigLoaderInternal } from "./types/config-loader-internal.interface";
import { LOAD_TIME_WARN_THRESHOLD_MS } from "./constants";
import { loadConfigFile, loadDefaults, loadEnvConfig } from "./sources";
import { cloneValue, countOverrideLeaves, isEmptyOverride, mergeConfigSources } from "./merge";
import { composeRuntimeOverrides, mergeRuntimeObjects } from "./runtime";
import { formatValidationIssueForLog } from "./utils";
import type { ConfigChangeContext, MergeConflict, MergeSource } from "./types";
import { getRollbackManager } from "./rollback";

export function loadImpl(
  base: IConfigLoaderInternal,
  options?: Partial<KoduckFlowConfig>,
  context?: ConfigChangeContext
): KoduckFlowConfig {
  const loader = base;

  if (loader.configCache && !options) {
    return loader.configCache;
  }

  const effectiveContext: ConfigChangeContext = {
    trigger: loader.hasLoadedOnce ? "reload" : "initial-load",
    ...context,
  };

  const runtimeOverrides = composeRuntimeOverrides(loader.runtimeOverrides, options);
  if (runtimeOverrides && !effectiveContext.overrides) {
    effectiveContext.overrides = runtimeOverrides;
  }

  const startTime = loader.now();

  const { defaults, file, env, merged, conflicts, validation } = computeConfigurationImpl(
    base,
    runtimeOverrides
  );

  loader.lastConflicts = conflicts;
  if (conflicts.length > 0) {
    logger.info(
      "Configuration merge conflicts resolved:",
      conflicts.map((c) => `${c.path}: ${c.resolutionStrategy}`)
    );
  }

  loader.lastValidationWarnings = validation.warnings;
  if (!validation.isValid) {
    const formattedErrors = validation.errors.map(formatValidationIssueForLog);
    if (effectiveContext.trigger.startsWith("runtime")) {
      loader.metrics.runtimeOverridesRejected.add(1, {
        source: effectiveContext.source ?? "system",
        trigger: effectiveContext.trigger,
      });
    }
    logger.error("Configuration validation failed:", formattedErrors);
    throw new Error(`Invalid configuration: ${formattedErrors.join("; ")}`);
  }

  if (validation.warnings.length > 0) {
    const formattedWarnings = validation.warnings.map(formatValidationIssueForLog);
    logger.warn("Configuration warnings:", formattedWarnings);
  }

  loader.configCache = merged;

  const loadTime = loader.now() - startTime;
  loader.loadMetrics.loadCount++;
  loader.loadMetrics.totalLoadTime += loadTime;
  loader.loadMetrics.lastLoadTime = loadTime;

  loader.metrics.loadCounter.add(1, {
    trigger: effectiveContext.trigger,
    source: effectiveContext.source ?? "system",
    dryRun: effectiveContext.dryRun ?? false,
  });
  loader.metrics.loadDuration.record(loadTime, {
    trigger: effectiveContext.trigger,
  });

  if (loadTime > LOAD_TIME_WARN_THRESHOLD_MS) {
    logger.warn(
      `Configuration load time ${loadTime.toFixed(2)}ms exceeds threshold ${LOAD_TIME_WARN_THRESHOLD_MS}ms`
    );
  } else {
    logger.info(
      `Configuration loaded in ${loadTime.toFixed(2)}ms (conflicts: ${conflicts.length}, trigger: ${effectiveContext.trigger})`
    );
  }

  const sources: MergeSource[] = [
    { source: "defaults", config: defaults },
    { source: "file", config: file },
    { source: "env", config: env },
  ];
  if (runtimeOverrides && !isEmptyOverride(runtimeOverrides)) {
    sources.push({ source: "runtime", config: runtimeOverrides });
  }
  updateConfigSourcesImpl(base, sources);

  refreshRuntimeOverrideGaugeImpl(base);
  loader.hasLoadedOnce = true;

  return merged;
}

export function reloadImpl(
  base: IConfigLoaderInternal,
  options?: Partial<KoduckFlowConfig>,
  context?: ConfigChangeContext
): KoduckFlowConfig {
  const loader = base;

  // 在配置变更前创建自动快照
  if (loader.hasLoadedOnce && loader.configCache) {
    const rollbackManager = getRollbackManager();
    const trigger = context?.trigger ?? "reload";
    rollbackManager.createAutoSnapshot(loader.configCache, trigger);
  }

  if (options && !isEmptyOverride(options)) {
    loader.runtimeOverrides = mergeRuntimeObjects(
      loader.runtimeOverrides,
      options
    ) as Partial<KoduckFlowConfig>;
    refreshRuntimeOverrideGaugeImpl(base);
    const runtimeContext: ConfigChangeContext = {
      trigger: context?.trigger ?? "runtime-cli",
      source: context?.source ?? "cli",
      overrides: context?.overrides ?? options,
    };
    if (context?.actor !== undefined) runtimeContext.actor = context.actor;
    if (context?.metadata !== undefined) runtimeContext.metadata = context.metadata;
    if (context?.dryRun !== undefined) runtimeContext.dryRun = context.dryRun;
    context = runtimeContext;
  }

  loader.configCache = undefined;
  const effectiveContext: ConfigChangeContext = {
    trigger: context?.trigger ?? "reload",
    ...context,
  };
  const config = loader.load(undefined, effectiveContext);
  notifyConfigChangeImpl(base, config, effectiveContext);
  return config;
}

export function computeConfigurationImpl(
  base: IConfigLoaderInternal,
  runtimeOverrides?: Partial<KoduckFlowConfig>
): {
  defaults: KoduckFlowConfig;
  file: Partial<KoduckFlowConfig>;
  env: Partial<KoduckFlowConfig>;
  runtime?: Partial<KoduckFlowConfig>;
  merged: KoduckFlowConfig;
  conflicts: MergeConflict[];
  validation: ValidationResult;
} {
  const defaults = loadDefaults();
  const file = loadConfigFile();
  const env = loadEnvConfig();
  const runtime =
    runtimeOverrides && !isEmptyOverride(runtimeOverrides) ? runtimeOverrides : undefined;

  const mergeSources: MergeSource[] = [
    { source: "file", config: file },
    { source: "env", config: env },
  ];
  if (runtime) {
    mergeSources.push({ source: "runtime", config: runtime });
  }

  const { mergedConfig, conflicts } = mergeConfigSources(defaults, mergeSources);

  const validation = base.validate(mergedConfig);
  const snapshot = {
    defaults,
    file,
    env,
    merged: mergedConfig,
    conflicts,
    validation,
  } as {
    defaults: KoduckFlowConfig;
    file: Partial<KoduckFlowConfig>;
    env: Partial<KoduckFlowConfig>;
    runtime?: Partial<KoduckFlowConfig>;
    merged: KoduckFlowConfig;
    conflicts: MergeConflict[];
    validation: ValidationResult;
  };

  if (runtime) {
    snapshot.runtime = runtime;
  }

  return snapshot;
}

export function updateConfigSourcesImpl(base: IConfigLoaderInternal, sources: MergeSource[]): void {
  const loader = base;
  loader.configSources = new Map();
  for (const { source, config } of sources) {
    if (source === "defaults" || !isEmptyOverride(config)) {
      loader.configSources.set(source, cloneValue(config));
    }
  }
}

export function refreshRuntimeOverrideGaugeImpl(base: IConfigLoaderInternal): void {
  const loader = base;
  const count = countOverrideLeaves(loader.runtimeOverrides);
  loader.metrics.activeRuntimeOverrides.set(count);
}

export function notifyConfigChangeImpl(
  base: IConfigLoaderInternal,
  config: KoduckFlowConfig,
  context: ConfigChangeContext
): void {
  const loader = base;
  loader.configChangeListeners.forEach((listener) => {
    try {
      listener(config);
    } catch (error) {
      logger.error("Error in config change listener:", error);
    }
  });

  try {
    loader.eventBus.system.configChange(
      {
        config,
        context,
      },
      "config-loader"
    );
  } catch (error) {
    logger.error("Failed to emit config change event via event bus:", error);
  }
}
