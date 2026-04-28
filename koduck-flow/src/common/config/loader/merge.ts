import type { ConfigSource, KoduckFlowConfig } from "../schema";

import type { MergeConflict } from "./types";

export interface MergeOutcome {
  mergedConfig: KoduckFlowConfig;
  conflicts: MergeConflict[];
}

export function mergeConfigSources(
  defaults: KoduckFlowConfig,
  orderedSources: Array<{ source: ConfigSource; config: Partial<KoduckFlowConfig> }>
): MergeOutcome {
  const conflicts: MergeConflict[] = [];
  const leafOrigins = new Map<string, { source: ConfigSource; value: unknown }>();

  let merged = mergeDeep({}, defaults, "defaults", conflicts, leafOrigins) as KoduckFlowConfig;

  for (const { source, config } of orderedSources) {
    if (!config || isEmptyOverride(config)) {
      continue;
    }
    merged = mergeDeep(merged, config, source, conflicts, leafOrigins) as KoduckFlowConfig;
  }

  return { mergedConfig: merged, conflicts };
}

function mergeDeep(
  target: unknown,
  source: unknown,
  sourceName: ConfigSource,
  conflicts: MergeConflict[],
  leafOrigins: Map<string, { source: ConfigSource; value: unknown }>,
  path = ""
): unknown {
  if (source === null || typeof source !== "object") {
    return assignLeaf(path, source, sourceName, conflicts, leafOrigins);
  }

  if (Array.isArray(source)) {
    const cloned = source.map((item) => cloneValue(item));
    return assignLeaf(path, cloned, sourceName, conflicts, leafOrigins);
  }

  const sourceObj = source as Record<string, unknown>;
  const baseObj =
    target && typeof target === "object" && !Array.isArray(target)
      ? (target as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(baseObj)) {
    result[key] = cloneValue(baseObj[key]);
  }

  for (const key of Object.keys(sourceObj)) {
    const sourceValue = sourceObj[key];
    if (sourceValue === undefined) {
      continue;
    }

    const currentPath = path ? `${path}.${key}` : key;
    const targetValue = result[key];

    if (isPlainObject(sourceValue)) {
      const previous = leafOrigins.get(currentPath);
      if (previous) {
        leafOrigins.delete(currentPath);
        if (!isPlainObject(targetValue) && !deepEqual(previous.value, sourceValue)) {
          conflicts.push({
            path: currentPath,
            sources: [previous, { source: sourceName, value: cloneValue(sourceValue) }],
            resolvedValue: cloneValue(sourceValue),
            resolutionStrategy: "merge",
          });
        }
      }

      const nextTarget = isPlainObject(targetValue) ? targetValue : {};
      result[key] = mergeDeep(
        nextTarget,
        sourceValue,
        sourceName,
        conflicts,
        leafOrigins,
        currentPath
      );
      continue;
    }

    if (targetValue !== undefined && !deepEqual(targetValue, sourceValue)) {
      const previous = leafOrigins.get(currentPath);
      if (previous) {
        conflicts.push({
          path: currentPath,
          sources: [previous, { source: sourceName, value: cloneValue(sourceValue) }],
          resolvedValue: cloneValue(sourceValue),
          resolutionStrategy: "override",
        });
      }
    }

    result[key] = assignLeaf(currentPath, sourceValue, sourceName, conflicts, leafOrigins);
  }

  return result;
}

function assignLeaf(
  path: string,
  value: unknown,
  source: ConfigSource,
  _conflicts: MergeConflict[],
  leafOrigins: Map<string, { source: ConfigSource; value: unknown }>
): unknown {
  const cloned = cloneValue(value);
  if (path) {
    leafOrigins.set(path, { source, value: cloneValue(cloned) });
  }
  return cloned;
}

export function cloneValue<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    result[key] = cloneValue((value as Record<string, unknown>)[key]);
  }
  return result as unknown as T;
}

export function isEmptyOverride(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value !== "object") return false;
  return Object.keys(value as Record<string, unknown>).length === 0;
}

export function countOverrideLeaves(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) {
    return value.reduce((acc, item) => acc + countOverrideLeaves(item), 0);
  }
  if (typeof value === "object") {
    let total = 0;
    for (const item of Object.values(value as Record<string, unknown>)) {
      total += countOverrideLeaves(item);
    }
    return total;
  }
  return 1;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) {
      return false;
    }
    for (const key of keysA) {
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
}
