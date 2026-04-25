/**
 * 可释放资源接口
 * 定义了一个标准的资源清理接口，用于管理需要手动释放的资源
 *
 * @example
 * ```typescript
 * const resource: IDisposable = {
 *   dispose() {
 *     // 清理资源逻辑
 * // 使用示例代码
 *   }
 * };
 * resource.dispose();
 * ```
 */
interface IDisposable {
  /**
   * 释放资源方法
   * 当资源不再需要时调用此方法来清理和释放相关资源
   */
  dispose(): void;
}

/**
 * 可释放资源工具类
 * 提供创建和检测 IDisposable 对象的工具方法
 */
const Disposable = {
  /**
   * 创建一个可释放的资源对象
   *
   * @param func - 资源释放时要执行的清理函数
   * @returns 返回一个实现了 IDisposable 接口的对象
   *
   * @example
   * ```typescript
   * const disposable = Disposable.create(() => {
   *   console.log('清理定时器');
   *   clearInterval(timerId);
   * });
   *
   * // 使用完毕后释放资源
   * disposable.dispose();
   * ```
   */
  create(func: () => void): IDisposable {
    return {
      dispose: func,
    };
  },

  /**
   * 检查对象是否实现了 IDisposable 接口
   *
   * @param thing - 要检查的对象
   * @returns 如果对象实现了 IDisposable 接口则返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * const obj = { dispose: () => console.log('dispose') };
   * if (Disposable.is(obj)) {
   *   obj.dispose(); // TypeScript 知道 obj 有 dispose 方法
   * }
   * ```
   */
  is(thing: unknown): thing is IDisposable {
    return (
      typeof thing === "object" &&
      thing !== null &&
      "dispose" in thing &&
      typeof (thing as { dispose: unknown }).dispose === "function"
    );
  },
};

export { type IDisposable, Disposable };
