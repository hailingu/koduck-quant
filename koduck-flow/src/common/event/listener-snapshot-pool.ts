import { ObjectPool } from "../memory/object-pool";
import { meter, ScopedMeter } from "../metrics";
import type { IListenerSnapshotPool } from "./types/listener-snapshot-pool.interface";

/**
 * 全局共享的监听器数组对象池实例（单例）
 *
 * 所有 ListenerSnapshotPool 实例共享同一个底层对象池，
 * 避免多次实例化带来的性能开销和内存浪费。
 */
let sharedListenerArrayPool: ObjectPool<unknown[]> | null = null;

function getSharedListenerArrayPool(): ObjectPool<unknown[]> {
  if (!sharedListenerArrayPool) {
    const memoryPoolMeter = meter("memory.pool");
    const poolMeter = new ScopedMeter(memoryPoolMeter, {
      feature: "object-pool",
      pool: "event.listener-array",
    });

    sharedListenerArrayPool = new ObjectPool<unknown[]>({
      name: "event.listener-array",
      create: () => [],
      reset: (arr) => {
        arr.length = 0;
      },
      maxSize: 2048,
      meter: poolMeter,
      warm: 64,
    });
  }
  return sharedListenerArrayPool;
}

/**
 * 监听器快照对象池实现
 *
 * 该类封装了监听器数组快照的对象池管理，
 * 为事件系统提供依赖注入的隔离层，避免与 memory/pools 模块产生循环依赖。
 *
 * @since 2.1.0
 * @class ListenerSnapshotPool
 * @implements {IListenerSnapshotPool}
 */
export class ListenerSnapshotPool implements IListenerSnapshotPool {
  private readonly pool: ObjectPool<unknown[]>;

  constructor(pool?: ObjectPool<unknown[]>) {
    // 使用提供的 pool 或全局共享的 pool
    this.pool = pool || getSharedListenerArrayPool();
  }

  /**
   * 从对象池借用一个数组快照，并复制源数组的内容
   *
   * @template T 监听器类型
   * @param source 源监听器数组
   * @returns 快照数组（从对象池借用）
   */
  borrowSnapshot<T>(source: T[]): T[] {
    const arr = this.pool.acquire() as T[];
    const len = source.length;
    for (let i = 0; i < len; i++) {
      arr.push(source[i]);
    }
    return arr;
  }

  /**
   * 将快照数组归还到对象池以便重用
   *
   * @template T 监听器类型
   * @param snapshot 快照数组（之前从 borrowSnapshot 获得）
   */
  releaseSnapshot<T>(snapshot: T[]): void {
    this.pool.release(snapshot as unknown[]);
  }
}

/**
 * 全局默认监听器快照对象池实例
 *
 * 事件系统默认使用该单例实例进行监听器快照管理。
 * 如需自定义池实例，可通过依赖注入传入。
 *
 * @since 2.1.0
 */
export const defaultListenerSnapshotPool: IListenerSnapshotPool = new ListenerSnapshotPool();
