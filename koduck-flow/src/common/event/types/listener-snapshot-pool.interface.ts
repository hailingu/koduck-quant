/**
 * Listener snapshot pool interface
 *
 * This interface provides borrow and return capabilities for listener array snapshots to the event system,
 * preventing additions/removals to the listener array during event firing from affecting the iteration process.
 *
 * @since 2.1.0
 * @interface IListenerSnapshotPool
 */
export interface IListenerSnapshotPool {
  /**
   * Borrow an array snapshot from the object pool and copy the source array contents
   *
   * @template T Listener type
   * @param source Source listener array
   * @returns Snapshot array (borrowed from pool)
   */
  borrowSnapshot<T>(source: T[]): T[];

  /**
   * Return snapshot array to the object pool for reuse
   *
   * @template T Listener type
   * @param snapshot Snapshot array (previously obtained from borrowSnapshot)
   */
  releaseSnapshot<T>(snapshot: T[]): void;
}
