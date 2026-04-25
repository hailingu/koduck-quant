import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  PoolStats,
  Task,
  TaskExecutionContext,
  TaskHandler,
  WorkerPoolEventListener,
} from "../../../src/common/worker-pool/types";
import type { WorkerPool } from "../../../src/common/worker-pool";
import type { EntityExecutor, FlowEngineRunSnapshot } from "../../../src/common/engine";
import { DefaultEngine, FlowEngineMetricsAdapter } from "../../../src/common/engine";
import type { IEdge, IFlow, IFlowNodeEntity, INode } from "../../../src/common/flow/types";
import {
  InMemoryMetricsProvider,
  getMetricsProvider,
  setMetricsProvider,
  type MetricsProvider,
} from "../../../src/common/metrics";

class MockWorkerPool implements WorkerPool {
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
    this.executedTasks.push(task);
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
    return Promise.all(tasks.map((task) => this.execute(task)));
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

interface TestEntity extends IFlowNodeEntity<INode> {
  id: string;
  type: string;
  node: INode;
  children: TestEntity[];
  toJSON(): Record<string, unknown>;
  dispose(): void;
}

const createEntity = (id: string, type: string, children: TestEntity[] = []): TestEntity =>
  ({
    id,
    type,
    node: {} as INode,
    children,
    toJSON: () => ({}),
    dispose: () => undefined,
  }) as TestEntity;

const createFlow = (
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

describe("DefaultEngine worker migration", () => {
  let previousProvider: MetricsProvider;

  beforeEach(() => {
    previousProvider = getMetricsProvider();
    setMetricsProvider(new InMemoryMetricsProvider());
  });

  afterEach(() => {
    setMetricsProvider(previousProvider);
  });

  test("executes entity using worker pool handler when configured", async () => {
    const pool = new MockWorkerPool();
    const engine = new DefaultEngine<INode, TestEntity>({
      worker: {
        pool,
      },
    });

    const child = createEntity("child", "task");
    const root = createEntity("root", "task", [child]);
    const flow = createFlow(
      root,
      new Map([
        [root.id, [child]],
        [child.id, []],
      ])
    );

    engine.attachFlow(flow);

    const executor: EntityExecutor<INode, TestEntity> = vi
      .fn()
      .mockResolvedValue({ status: "success" });
    engine.registerExecutor("task", executor);

    const result = await engine.run();

    expect(result.ok).toBe(true);
    expect(result.entityResults.get(root.id)?.status).toBe("success");
    expect(result.entityResults.get(child.id)?.status).toBe("success");
    expect(pool.executedTasks.length).toBeGreaterThan(0);
  });

  test("falls back to main thread execution when worker rejects", async () => {
    const pool = new MockWorkerPool();
    const engine = new DefaultEngine<INode, TestEntity>({
      worker: {
        pool,
      },
      stopOnError: true,
    });

    const root = createEntity("root", "task");
    const flow = createFlow(root, new Map([[root.id, []]]));

    engine.attachFlow(flow);

    const executor: EntityExecutor<INode, TestEntity> = vi
      .fn()
      .mockResolvedValue({ status: "success" });
    engine.registerExecutor("task", executor);

    pool.failNextExecution = true;

    const result = await engine.run();

    expect(result.ok).toBe(true);
    expect(result.entityResults.get(root.id)?.status).toBe("success");
    expect(executor).toHaveBeenCalledTimes(1);
  });

  test("captures worker execution metrics snapshot", async () => {
    const pool = new MockWorkerPool();
    const engine = new DefaultEngine<INode, TestEntity>({
      worker: {
        pool,
      },
    });

    const snapshots: FlowEngineRunSnapshot[] = [];
    const adapter = new FlowEngineMetricsAdapter({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      attributes: { suite: "flow-engine-worker" },
    });
    adapter.attach(engine);

    const child = createEntity("child", "task");
    const root = createEntity("root", "task", [child]);
    const flow = createFlow(
      root,
      new Map([
        [root.id, [child]],
        [child.id, []],
      ])
    );

    engine.attachFlow(flow);

    const executor: EntityExecutor<INode, TestEntity> = vi
      .fn()
      .mockResolvedValue({ status: "success" });
    engine.registerExecutor("task", executor);

    try {
      const result = await engine.run();
      expect(result.ok).toBe(true);
    } finally {
      adapter.detach();
    }

    expect(snapshots).toHaveLength(1);
    const snapshot = snapshots[0];
    expect(snapshot.hasWorker).toBe(true);
    expect(snapshot.workerExecutions).toBe(pool.executedTasks.length);
    expect(snapshot.workerFailures).toBe(0);
    expect(snapshot.fallbackExecutions).toBe(0);
    expect(snapshot.entitiesProcessed).toBe(2);
  });

  test("records fallback metrics when worker execution fails", async () => {
    const pool = new MockWorkerPool();
    const engine = new DefaultEngine<INode, TestEntity>({
      worker: {
        pool,
      },
      stopOnError: true,
    });

    const snapshots: FlowEngineRunSnapshot[] = [];
    const adapter = new FlowEngineMetricsAdapter({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
    });
    adapter.attach(engine);

    const root = createEntity("root", "task");
    const flow = createFlow(root, new Map([[root.id, []]]));
    engine.attachFlow(flow);

    const executor: EntityExecutor<INode, TestEntity> = vi
      .fn()
      .mockResolvedValue({ status: "success" });
    engine.registerExecutor("task", executor);

    pool.failNextExecution = true;

    try {
      const result = await engine.run();
      expect(result.ok).toBe(true);
    } finally {
      adapter.detach();
    }

    expect(snapshots).toHaveLength(1);
    const snapshot = snapshots[0];
    expect(snapshot.hasWorker).toBe(true);
    expect(snapshot.workerExecutions).toBe(0);
    expect(snapshot.workerFailures).toBe(1);
    expect(snapshot.fallbackExecutions).toBe(1);
    expect(snapshot.entitiesProcessed).toBe(1);
  });
});
