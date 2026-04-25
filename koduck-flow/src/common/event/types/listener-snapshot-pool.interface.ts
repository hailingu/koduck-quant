/**
 * 监听器快照对象池接口
 *
 * 该接口用于为事件系统提供监听器数组快照的借用和归还能力，
 * 避免在事件触发期间对监听器数组的增删影响迭代过程。
 *
 * @since 2.1.0
 * @interface IListenerSnapshotPool
 */
export interface IListenerSnapshotPool {
  /**
   * 从对象池借用一个数组快照，并复制源数组的内容
   *
   * @template T 监听器类型
   * @param source 源监听器数组
   * @returns 快照数组（从对象池借用）
   */
  borrowSnapshot<T>(source: T[]): T[];

  /**
   * 将快照数组归还到对象池以便重用
   *
   * @template T 监听器类型
   * @param snapshot 快照数组（之前从 borrowSnapshot 获得）
   */
  releaseSnapshot<T>(snapshot: T[]): void;
}
