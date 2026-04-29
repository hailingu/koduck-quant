import type { IEdge, IFlow, IFlowNodeEntity, INode } from "../../flow/types";
import type { WorkerPool } from "../../worker-pool";
import type { IDisposable } from "../../disposable";

// Base type: engine config
/**
 *
 */
export interface EngineConfig {
  // Maximum concurrency (sibling nodes at the same level can execute in parallel)
  concurrency?: number;
  // Whether to stop the entire flow when a node execution errors
  stopOnError?: boolean;
  // Whether to auto-validate before execution (e.g., detect root, cycles, etc.)
  validateBeforeRun?: boolean;
  // Strict entity graph mode: only rely on entity relationships, fallback to INode mapping is not allowed
  strictEntityGraph?: boolean;
  // Worker thread config (backward compatible)
  worker?: EngineWorkerConfig | null;
  // Whether to enable Worker Pool
  enableWorkerPool?: boolean;
  // Worker Pool config
  workerPoolConfig?: WorkerPoolEngineConfig | null;
}

/**
 * Worker Pool configuration interface in Engine
 *
 * Provides configuration options required for Worker Pool and DefaultEngine integration
 */
export interface WorkerPoolEngineConfig {
  // Create Worker Pool instance (engine will create one if not provided)
  pool?: WorkerPool;
  // Worker Pool task type marker
  taskType?: string;
  // Worker Pool task timeout (ms)
  taskTimeoutMs?: number;
  // List of entity types supported by Worker execution (all supported if empty)
  supportedEntityTypes?: string[];
  // Routing threshold based on load conditions
  routingStrategy?: "always" | "on-demand" | "balanced";
}

/**
 *
 */
export interface EngineWorkerConfig {
  pool: WorkerPool;
  taskType?: string;
  taskTimeoutMs?: number;
}

// Run options (optional parameters for a single run call)
/**
 *
 */
export interface RunOptions<
  N extends INode = INode,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
> {
  // Start execution from the specified entity; defaults to root entity
  entryEntity?: NE;
  // Cancellation signal
  signal?: AbortSignal;
}

// Node execution context (passed to executor)
/**
 *
 */
export interface ExecutionContext<
  N extends INode = INode,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
> {
  // Flow
  flow: IFlow<N, IEdge, NE>;
  // Currently executing entity (authoritative data carrier)
  entity: NE;
  // Associated node (used only for structure and ordering)
  node: N;
  // Shared KV area for the same run
  shared: Map<string, unknown>;
  // Worker Pool instance (if enabled)
  workerPool?: WorkerPool;
}

// Node execution result
/**
 *
 */
export type EntityResult = {
  status: "success" | "error" | "skipped";
  output?: unknown;
  error?: Error;
};

// Node executor: registered by specific engine or business side
/**
 *
 */
export type EntityExecutor<
  N extends INode = INode,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
> = (ctx: ExecutionContext<N, NE>) => Promise<EntityResult> | EntityResult;

// Flow run result
/**
 *
 */
export interface FlowRunResult {
  ok: boolean;
  // key: entityId
  entityResults: Map<string, EntityResult>;
  startedAt: number;
  finishedAt: number;
}

// Engine status
/**
 *
 */
export type EngineStatus = "idle" | "running" | "paused" | "stopped";

// Engine interface
/**
 *
 */
export interface IEngine<
  N extends INode = INode,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
> extends IDisposable {
  readonly status: EngineStatus;
  readonly config: Required<EngineConfig>;

  attachFlow(flow: IFlow<N, IEdge, NE>): void;
  detachFlow(): void;
  getFlow(): IFlow<N, IEdge, NE> | undefined;

  // Execution
  run(options?: RunOptions<N, NE>): Promise<FlowRunResult>;
  pause(): void;
  resume(): void;
  stop(): void;

  // Executor registration
  registerExecutor(type: string, executor: EntityExecutor<N, NE>): void;
  unregisterExecutor(type: string): void;
  hasExecutor(type: string): boolean;
}

/**
 *
 */
export interface FlowEngineRunStartEvent {
  flowId: string;
  startedAt: number;
  hasWorker: boolean;
}

/**
 *
 */
export interface FlowEngineRunFinishEvent {
  flowId: string;
  ok: boolean;
  durationMs: number;
  startedAt: number;
  finishedAt: number;
  entityResults: Map<string, EntityResult>;
}

/**
 *
 */
export interface FlowEngineMainThreadExecutionEvent {
  flowId: string;
  entityId: string;
  entityType?: string;
  durationMs: number;
  origin: "baseline" | "fallback";
}
