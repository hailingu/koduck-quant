import { ObjectPool } from "../memory/object-pool";
import { meter, ScopedMeter } from "../metrics";
import type { IListenerSnapshotPool } from "./types/listener-snapshot-pool.interface";

/**
 * Globally shared listener array object pool instance (singleton)
 *
 * All ListenerSnapshotPool instances share the same underlying object pool,
 * avoiding performance overhead and memory waste from multiple instantiations.
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
 * Listener snapshot pool implementation
 *
 * This class encapsulates object pool management for listener array snapshots,
 * providing a dependency injection isolation layer for the event system, avoiding circular dependencies with the memory/pools module.
 *
 * @since 2.1.0
 * @class ListenerSnapshotPool
 * @implements {IListenerSnapshotPool}
 */
export class ListenerSnapshotPool implements IListenerSnapshotPool {
  private readonly pool: ObjectPool<unknown[]>;

  constructor(pool?: ObjectPool<unknown[]>) {
    // Use provided pool or globally shared pool
    this.pool = pool || getSharedListenerArrayPool();
  }

  /**
   * Borrow an array snapshot from the object pool and copy the source array contents
   *
   * @template T Listener type
   * @param source Source listener array
   * @returns Snapshot array (borrowed from pool)
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
   * Return snapshot array to the object pool for reuse
   *
   * @template T Listener type
   * @param snapshot Snapshot array (previously obtained from borrowSnapshot)
   */
  releaseSnapshot<T>(snapshot: T[]): void {
    this.pool.release(snapshot as unknown[]);
  }
}

/**
 * Global default listener snapshot pool instance
 *
 * The event system uses this singleton instance by default for listener snapshot management.
 * To customize the pool instance, pass it via dependency injection.
 *
 * @since 2.1.0
 */
export const defaultListenerSnapshotPool: IListenerSnapshotPool = new ListenerSnapshotPool();
