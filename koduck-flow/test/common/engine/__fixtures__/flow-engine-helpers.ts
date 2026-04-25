import { vi } from "vitest";
import type {
  PoolStats,
  Task,
  TaskExecutionContext,
  TaskHandler,
  WorkerPool,
  WorkerPoolEventListener,
} from "../../../src/common/worker-pool/types.ts";
import type { EntityExecutor } from "../../../src/common/engine/index.ts";
import type { IEdge, IFlow, IFlowNodeEntity, INode } from "../../../src/common/flow/types.ts";

export class MockWorkerPool implements WorkerPool {
  public readonly executedTasks: Task<unknown>[] = [];
  public failNextExecution = false;
  private readonly handlers = new Map<string, TaskHandler<unknown, unknown>>();
  private readonly stats: PoolStats = {
    totalWorkers: 1,
    activeWorkers: 0,
    queueSize: 0,
    completedTasks: 0,
    failedTasks: 0,
  };
  private readonly listeners = new Set<WorkerPoolEventListener>();

  async execute<T>(task: Task<T>): Promise<T> {
    this.executedTasks.push(task as Task<unknown>);
    if (this.failNextExecution) {
      this.failNextExecution = false;
      return Promise.reject(new Error("forced worker failure"));
    }

    const handler = this.handlers.get(task.type) as TaskHandler<T, unknown> | undefined;
    if (!handler) {
      throw new Error(`No handler registered for type ${task.type}`);
    }

    const context: TaskExecutionContext = {
      attempt: 1,
      maxRetries: 3,
      taskId: `task-${this.executedTasks.length}`,
      fallback: false,
      cancellationToken: {
        isCancellationRequested: false,
        onCancellation: vi.fn(),
        throwIfCancellationRequested: vi.fn(),
      },
      stats: this.stats,
    };

    const result = await Promise.resolve(handler(task.payload, context));
    return result as T;
  }

  executeBatch<T>(tasks: Task<T>[]): Promise<T[]> {
    return Promise.all(tasks.map((task) => this.execute(task))) as Promise<T[]>;
  }

  getStats(): PoolStats {
    return this.stats;
  }

  addEventListener(listener: WorkerPoolEventListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: WorkerPoolEventListener): void {
    this.listeners.delete(listener);
  }

  registerHandler<TPayload = unknown, TResult = unknown>(
    type: string,
    handler: TaskHandler<TPayload, TResult>
  ): void {
    this.handlers.set(type, handler as TaskHandler<unknown, unknown>);
  }

  unregisterHandler(type: string): void {
    this.handlers.delete(type);
  }
}

export interface TestEntity extends IFlowNodeEntity<INode> {
  id: string;
  type: string;
  node: INode;
  children: TestEntity[];
  toJSON(): Record<string, unknown>;
  dispose(): void;
}

export const createTestEntity = (
  id: string,
  type: string,
  children: TestEntity[] = []
): TestEntity =>
  ({
    id,
    type,
    node: {} as INode,
    children,
    toJSON: () => ({}),
    dispose: () => undefined,
  }) as TestEntity;

export const createTestFlow = (
  root: TestEntity,
  childMap: Map<string, TestEntity[]>
): IFlow<INode, IEdge, TestEntity> => {
  const entities = new Map<string, TestEntity>();

  const register = (entity: TestEntity): void => {
    entities.set(entity.id, entity);
    for (const child of childMap.get(entity.id) ?? []) {
      register(child);
    }
  };

  register(root);

  return {
    id: "flow-1",
    dispose: vi.fn(),
    toJSON: () => ({}),
    getRootEntity: () => root,
    getChildEntities: (entity: TestEntity) => childMap.get(entity.id) ?? [],
    getEntity: (id: string) => entities.get(id),
  } as unknown as IFlow<INode, IEdge, TestEntity>;
};

export const registerTestExecutor = (
  engine: { registerExecutor(type: string, executor: EntityExecutor<INode, TestEntity>): void },
  executor?: EntityExecutor<INode, TestEntity>
): EntityExecutor<INode, TestEntity> => {
  const impl =
    executor ??
    (vi.fn().mockResolvedValue({ status: "success" }) as unknown as EntityExecutor<
      INode,
      TestEntity
    >);
  engine.registerExecutor("task", impl);
  return impl;
};
