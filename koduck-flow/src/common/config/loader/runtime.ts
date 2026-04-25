import type { DuckFlowConfig } from "../schema";

import { cloneValue, isEmptyOverride } from "./merge";

export function mergeRuntimeObjects(base: unknown, addition: unknown): unknown {
  if (addition === undefined) {
    return cloneValue(base);
  }
  if (addition === null || typeof addition !== "object") {
    return cloneValue(addition);
  }
  if (Array.isArray(addition)) {
    return addition.map((item) => cloneValue(item));
  }

  const baseObject =
    base && typeof base === "object" && !Array.isArray(base)
      ? (base as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(baseObject)) {
    result[key] = cloneValue(baseObject[key]);
  }
  for (const key of Object.keys(addition as Record<string, unknown>)) {
    result[key] = mergeRuntimeObjects(baseObject[key], (addition as Record<string, unknown>)[key]);
  }

  return result;
}

export function composeRuntimeOverrides(
  persisted: Partial<DuckFlowConfig>,
  additional?: Partial<DuckFlowConfig>
): Partial<DuckFlowConfig> | undefined {
  const hasPersisted = !isEmptyOverride(persisted);
  const hasAdditional = additional && !isEmptyOverride(additional);
  if (!hasPersisted && !hasAdditional) {
    return undefined;
  }

  let merged: Partial<DuckFlowConfig> | undefined;
  if (hasPersisted) {
    merged = mergeRuntimeObjects({}, persisted) as Partial<DuckFlowConfig>;
  }
  if (hasAdditional) {
    merged = mergeRuntimeObjects(merged ?? {}, additional) as Partial<DuckFlowConfig>;
  }

  return merged;
}
