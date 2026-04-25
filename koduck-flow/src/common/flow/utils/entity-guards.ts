import type { IFlowEdgeEntity, IFlowNodeEntity } from "../types";

/**
 * Shape of a type guard function.
 */
type EntityGuardFn<T> = (entity: unknown) => entity is T;

/**
 * Allows callers to override the default guard logic while having access to the fallback guard.
 */
type GuardOverride<T> = (entity: unknown, fallback: EntityGuardFn<T>) => entity is T;

/**
 * Configuration for {@link createEntityGuards}. Enables custom guards and alternative key hints.
 */
export type EntityGuardOptions<
  NE extends IFlowNodeEntity = IFlowNodeEntity,
  EE extends IFlowEdgeEntity = IFlowEdgeEntity,
> = {
  /** Optional override used to determine if an entity is a node. */
  isNodeEntity?: GuardOverride<NE>;
  /** Optional override used to determine if an entity is an edge. */
  isEdgeEntity?: GuardOverride<EE>;
  /** Additional property names that should be treated as node indicators. */
  nodeKeys?: readonly string[];
  /** Additional property names that should be treated as edge indicators. */
  edgeKeys?: readonly string[];
};

/**
 * Result returned by {@link createEntityGuards} matching the expectations of {@link EntityRegistry}.
 */
export type EntityGuards<
  NE extends IFlowNodeEntity = IFlowNodeEntity,
  EE extends IFlowEdgeEntity = IFlowEdgeEntity,
> = {
  isNodeEntity: EntityGuardFn<NE>;
  isEdgeEntity: EntityGuardFn<EE>;
};

const DEFAULT_NODE_KEYS = Object.freeze(["node"] as const);
const DEFAULT_EDGE_KEYS = Object.freeze(["edge"] as const);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasAnyKey = (entity: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.some((key) => key in entity);

/**
 * Creates reusable entity type guards that mirror the logic consumed by {@link EntityRegistry}.
 * Callers can inject custom guards or extend the default heuristics via additional key hints.
 *
 * @param options optional overrides that tweak the detection logic
 * @returns a pair of type guards aligned with the registry expectations
 */
export function createEntityGuards<
  NE extends IFlowNodeEntity = IFlowNodeEntity,
  EE extends IFlowEdgeEntity = IFlowEdgeEntity,
>(options: EntityGuardOptions<NE, EE> = {}): EntityGuards<NE, EE> {
  const nodeKeys = options.nodeKeys?.length ? [...options.nodeKeys] : [...DEFAULT_NODE_KEYS];
  const edgeKeys = options.edgeKeys?.length ? [...options.edgeKeys] : [...DEFAULT_EDGE_KEYS];

  const defaultNodeGuard: EntityGuardFn<NE> = (entity): entity is NE => {
    if (!isRecord(entity)) {
      return false;
    }
    return hasAnyKey(entity, nodeKeys);
  };

  const defaultEdgeGuard: EntityGuardFn<EE> = (entity): entity is EE => {
    if (!isRecord(entity)) {
      return false;
    }
    return hasAnyKey(entity, edgeKeys);
  };

  const isNodeEntity: EntityGuardFn<NE> = options.isNodeEntity
    ? (entity): entity is NE => options.isNodeEntity!(entity, defaultNodeGuard)
    : defaultNodeGuard;

  const isEdgeEntity: EntityGuardFn<EE> = options.isEdgeEntity
    ? (entity): entity is EE => options.isEdgeEntity!(entity, defaultEdgeGuard)
    : defaultEdgeGuard;

  return { isNodeEntity, isEdgeEntity };
}
