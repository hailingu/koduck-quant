import type { IEdge, IFlow, IFlowNodeEntity, INode } from "../../flow/types";
import type { WorkerPool } from "../../worker-pool";
import type { IDisposable } from "../../disposable";

// 基础类型：引擎配置
/**
 *
 */
export interface EngineConfig {
  // 最大并发数（同一层级的兄弟节点可并行执行）
  concurrency?: number;
  // 节点执行出错时是否停止整个流程
  stopOnError?: boolean;
  // 是否在开始执行前自动校验（例如检测 root、环等）
  validateBeforeRun?: boolean;
  // 严格实体图模式：仅依赖实体关系，不允许回退到 INode 映射
  strictEntityGraph?: boolean;
  // Worker 线程配置（后向兼容）
  worker?: EngineWorkerConfig | null;
  // 是否启用 Worker Pool
  enableWorkerPool?: boolean;
  // Worker Pool 配置
  workerPoolConfig?: WorkerPoolEngineConfig | null;
}

/**
 * Worker Pool 在 Engine 中的配置接口
 *
 * 提供 Worker Pool 与 DefaultEngine 集成所需的配置选项
 */
export interface WorkerPoolEngineConfig {
  // 创建 Worker Pool 实例（如果未提供则引擎会创建）
  pool?: WorkerPool;
  // Worker Pool 任务类型标记
  taskType?: string;
  // Worker Pool 任务超时（ms）
  taskTimeoutMs?: number;
  // 支持 Worker 执行的实体类型列表（如为空则全部支持）
  supportedEntityTypes?: string[];
  // 基于负载情况的路由阈值
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

// 运行选项（一次 run 调用的可选参数）
/**
 *
 */
export interface RunOptions<
  N extends INode = INode,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
> {
  // 从指定实体开始执行；缺省为根实体
  entryEntity?: NE;
  // 取消信号
  signal?: AbortSignal;
}

// 节点执行上下文（传给执行器）
/**
 *
 */
export interface ExecutionContext<
  N extends INode = INode,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
> {
  // 流
  flow: IFlow<N, IEdge, NE>;
  // 当前执行实体（权威数据载体）
  entity: NE;
  // 关联节点（仅用于结构与顺序）
  node: N;
  // 同一次 run 的共享 KV 区
  shared: Map<string, unknown>;
  // Worker Pool 实例（如已启用）
  workerPool?: WorkerPool;
}

// 节点执行结果
/**
 *
 */
export type EntityResult = {
  status: "success" | "error" | "skipped";
  output?: unknown;
  error?: Error;
};

// 节点执行器：由具体引擎或业务侧注册
/**
 *
 */
export type EntityExecutor<
  N extends INode = INode,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
> = (ctx: ExecutionContext<N, NE>) => Promise<EntityResult> | EntityResult;

// 流程运行结果
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

// 引擎状态
/**
 *
 */
export type EngineStatus = "idle" | "running" | "paused" | "stopped";

// 引擎接口
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

  // 执行
  run(options?: RunOptions<N, NE>): Promise<FlowRunResult>;
  pause(): void;
  resume(): void;
  stop(): void;

  // 执行器注册
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
