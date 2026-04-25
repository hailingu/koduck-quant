import { logger } from "../../logger";
import type { DuckFlowConfig, ValidationIssue } from "../schema";
import { isEmptyOverride } from "./merge";
import { mergeRuntimeObjects } from "./runtime";
import { formatValidationIssueForLog } from "./utils";
import { computeConfigurationImpl, refreshRuntimeOverrideGaugeImpl } from "./core";
import { RUNTIME_AUDIT_MAX_ENTRIES } from "./constants";
import type { IConfigLoaderInternal } from "./types/config-loader-internal.interface";
import type {
  ConfigChangeContext,
  ConfigChangeTrigger,
  MergeConflict,
  RuntimeOverrideAuditRecord,
  RuntimeOverrideOptions,
  RuntimeOverrideResult,
  RuntimeOverrideSource,
} from "./types";

interface LoaderMetrics {
  runtimeOverridesApplied: { add: (value: number, attributes?: Record<string, unknown>) => void };
  runtimeOverridesRejected: { add: (value: number, attributes?: Record<string, unknown>) => void };
}

/**
 * 运行时管理器所需的状态接口
 * 用于解耦 runtime-manager 与 ConfigLoader 的直接依赖
 */
interface RuntimeManagerState {
  runtimeOverrides: Partial<DuckFlowConfig>;
  runtimeAuditTrail: RuntimeOverrideAuditRecord[];
  metrics: LoaderMetrics & {
    activeRuntimeOverrides: { set: (value: number) => void };
  };
  lastConflicts: MergeConflict[];
  lastValidationWarnings: ValidationIssue[];
  validate(config: DuckFlowConfig): {
    isValid: boolean;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  };
  refreshRuntimeOverrideGauge(): void;
  reload(options?: Partial<DuckFlowConfig>, context?: ConfigChangeContext): DuckFlowConfig;
}

export function runtimeTriggerFromSourceImpl(source: RuntimeOverrideSource): ConfigChangeTrigger {
  switch (source) {
    case "cli":
      return "runtime-cli";
    case "http":
      return "runtime-http";
    default:
      return "runtime-api";
  }
}

export function recordRuntimeAuditImpl(
  state: RuntimeManagerState,
  record: RuntimeOverrideAuditRecord
): void {
  state.runtimeAuditTrail.push(record);
  if (state.runtimeAuditTrail.length > RUNTIME_AUDIT_MAX_ENTRIES) {
    state.runtimeAuditTrail.splice(0, state.runtimeAuditTrail.length - RUNTIME_AUDIT_MAX_ENTRIES);
  }
}

export function applyRuntimeOverridesImpl(
  state: RuntimeManagerState,
  overrides: Partial<DuckFlowConfig>,
  options: RuntimeOverrideOptions = {}
): RuntimeOverrideResult {
  if (!overrides || isEmptyOverride(overrides)) {
    throw new Error("Runtime overrides cannot be empty");
  }

  const source = options.source ?? "api";
  const dryRun = options.dryRun ?? false;
  const sanitizedOverrides = mergeRuntimeObjects({}, overrides) as Partial<DuckFlowConfig>;
  const timestamp = Date.now();

  const nextRuntimeOverrides = mergeRuntimeObjects(
    state.runtimeOverrides,
    sanitizedOverrides
  ) as Partial<DuckFlowConfig>;

  const context: ConfigChangeContext = {
    trigger: runtimeTriggerFromSourceImpl(source),
    source,
    overrides: sanitizedOverrides,
    dryRun,
  };
  if (options.actor !== undefined) context.actor = options.actor;
  if (options.metadata !== undefined) context.metadata = options.metadata;
  const actorInfo = context.actor ? ` (actor=${context.actor})` : "";

  const snapshot = computeConfigurationImpl(
    state as unknown as IConfigLoaderInternal,
    nextRuntimeOverrides
  );

  const audit: RuntimeOverrideAuditRecord = {
    source,
    overrides: sanitizedOverrides,
    appliedOverrides: sanitizedOverrides,
    timestamp,
    status: "applied",
    dryRun,
  };
  if (options.actor !== undefined) audit.actor = options.actor;
  if (options.metadata !== undefined) audit.metadata = options.metadata;

  if (!snapshot.validation.isValid) {
    const reason = snapshot.validation.errors.map(formatValidationIssueForLog).join("; ");
    audit.status = "rejected";
    audit.reason = reason;
    recordRuntimeAuditImpl(state, audit);
    state.metrics.runtimeOverridesRejected.add(1, {
      source,
      trigger: context.trigger,
    });
    throw new Error(`Runtime overrides rejected: ${reason}`);
  }

  if (dryRun) {
    logger.info(`Runtime overrides evaluated via ${source}${actorInfo} (dry-run)`);
    recordRuntimeAuditImpl(state, audit);
    state.metrics.runtimeOverridesApplied.add(1, {
      source,
      dryRun: true,
      trigger: context.trigger,
    });
    return {
      config: snapshot.merged,
      appliedOverrides: sanitizedOverrides,
      conflicts: snapshot.conflicts,
      warnings: snapshot.validation.warnings,
      audit,
      dryRun: true,
    };
  }

  state.runtimeOverrides = nextRuntimeOverrides;
  refreshRuntimeOverrideGaugeImpl(state as unknown as IConfigLoaderInternal);
  const config = state.reload(undefined, context);

  audit.appliedOverrides = sanitizedOverrides;
  recordRuntimeAuditImpl(state, audit);
  state.metrics.runtimeOverridesApplied.add(1, {
    source,
    dryRun: false,
    trigger: context.trigger,
  });

  logger.info(
    `Runtime overrides applied via ${source}${actorInfo} (keys=${Object.keys(sanitizedOverrides).length})`
  );

  return {
    config,
    appliedOverrides: sanitizedOverrides,
    conflicts: state.lastConflicts,
    warnings: state.lastValidationWarnings,
    audit,
    dryRun: false,
  };
}

export function getRuntimeOverridesImpl(state: RuntimeManagerState): Partial<DuckFlowConfig> {
  return mergeRuntimeObjects({}, state.runtimeOverrides) as Partial<DuckFlowConfig>;
}

export function getRuntimeAuditTrailImpl(
  state: RuntimeManagerState,
  limit = 50
): RuntimeOverrideAuditRecord[] {
  if (limit <= 0) {
    return [];
  }
  return state.runtimeAuditTrail.slice(-limit);
}
