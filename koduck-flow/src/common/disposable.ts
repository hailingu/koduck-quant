/**
 * Disposable resource interface
 * Defines a standard resource cleanup interface for managing resources that require manual release
 *
 * @example
 * ```typescript
 * const resource: IDisposable = {
 *   dispose() {
 *     // Resource cleanup logic
 * // Usage example code
 *   }
 * };
 * resource.dispose();
 * ```
 */
interface IDisposable {
  /**
   * Resource release method
   * Call this method to clean up and release related resources when they are no longer needed
   */
  dispose(): void;
}

/**
 * Disposable resource utility class
 * Provides utility methods for creating and detecting IDisposable objects
 */
const Disposable = {
  /**
   * Creates a disposable resource object
   *
   * @param func - Cleanup function to execute when releasing the resource
   * @returns Returns an object implementing the IDisposable interface
   *
   * @example
   * ```typescript
   * const disposable = Disposable.create(() => {
   *   console.log('Clean up timer');
   *   clearInterval(timerId);
   * });
   *
   * // Release resources after use is complete
   * disposable.dispose();
   * ```
   */
  create(func: () => void): IDisposable {
    return {
      dispose: func,
    };
  },

  /**
   * Checks whether an object implements the IDisposable interface
   *
   * @param thing - Object to check
   * @returns true if the object implements IDisposable, otherwise false
   *
   * @example
   * ```typescript
   * const obj = { dispose: () => console.log('dispose') };
   * if (Disposable.is(obj)) {
   *   obj.dispose(); // TypeScript knows obj has dispose method
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
