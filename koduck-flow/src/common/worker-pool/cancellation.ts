/**
 * Cancellation Token System
 *
 * Implements standard cancellation protocol for cooperative task shutdown.
 * Follows patterns established by AbortController and CancellationToken in .NET.
 *
 * Model:
 * - CancellationTokenSource: Creates and controls cancellation
 * - CancellationToken: Observes cancellation (read-only)
 * - Cancel propagation: Fires registered callbacks immediately
 * - Idempotent: Multiple cancels are safe, only fires once
 *
 * Usage Pattern:
 * 1. Create source: const source = new CancellationTokenSource()
 * 2. Pass token to operation: operation(source.token)
 * 3. Check cancellation in operation via polling, assertion, or callbacks
 * 4. Request cancellation: source.cancel()
 *
 * Integration with worker pool:
 * - One source per task execution
 * - Token passed in TaskExecutionContext
 * - Cancelled when timeout expires or task explicitly cancelled
 * - Handlers check/respond to cancellation for graceful shutdown
 *
 * Performance:
 * - O(1) cancel operation (direct callback invocation)
 * - O(1) registration (Set insertion)
 * - O(n) cancellation if n callbacks registered
 * - Low overhead: minimal allocations, no timers, no polling
 *
 * @module CancellationToken
 * @see {@link CancellationTokenSource}
 * @see {@link CancellationToken}
 * @see {@link TaskExecutionContext}
 *
 * @example
 * ```typescript
 * // In task handler
 * const handler: TaskHandler<DataChunk[], Result> = async (chunks, context) => {
 *   const results = [];
 *
 *   // Register cleanup on cancellation
 *   context.cancellationToken.onCancellation(() => {
 *     console.log('Task cancelled, cleaning up');
 *     conn?.close();
 *   });
 *
 *   for (const chunk of chunks) {
 *     // Guard against cancellation (polling style)
 *     if (context.cancellationToken.isCancellationRequested) {
 *       console.log('Stopping processing due to cancellation');
 *       break;
 *     }
 *
 *     // Or use assertion (throws if cancelled)
 *     context.cancellationToken.throwIfCancellationRequested();
 *
 *     const result = await processChunk(chunk);
 *     results.push(result);
 *   }
 *
 *   return combineResults(results);
 * };
 * ```
 */

import { WorkerPoolError, type CancellationToken } from "./types";

/**
 * Cancellation error code constant
 * @internal
 */
const TASK_CANCELLED_CODE = "TASK_CANCELLED" as const;

/**
 * Internal Cancellation Token Implementation
 *
 * Manages cancellation state and callbacks. Private implementation of
 * CancellationToken interface.
 *
 * State Machine:
 * - Initial: cancelled = false
 * - Transition: cancel() -> cancelled = true
 * - Callbacks invoked during transition
 * - Idempotent: subsequent cancel() calls no-op
 *
 * @internal
 */
class CancellationTokenImpl implements CancellationToken {
  /**
   * Cancellation flag
   *
   * True once cancellation requested.
   * Transitions from false to true exactly once.
   *
   * @private
   */
  private cancelled = false;

  /**
   * Registered cancellation callbacks
   *
   * Set of functions to invoke when cancellation occurs.
   * Cleared after invocation to prevent memory leaks.
   * Safe to modify during iteration (use for-of).
   *
   * @private
   */
  private readonly callbacks = new Set<() => void>();

  /**
   * Request cancellation
   *
   * Sets cancelled flag and invokes all registered callbacks.
   * No effect if already cancelled (idempotent).
   * Exceptions in callbacks are caught and suppressed to ensure
   * all callbacks execute.
   *
   * Performance: O(n) where n = number of registered callbacks
   *
   * Example:
   * ```typescript
   * // In pool timeout handler
   * if (remainingTime <= 0) {
   *   tokenSource.cancel(); // Cancels the token
   * }
   * ```
   */
  cancel(): void {
    if (this.cancelled) {
      return;
    }
    this.cancelled = true;
    for (const callback of this.callbacks) {
      try {
        callback();
      } catch {
        // Suppress callback exceptions to ensure all callbacks execute
        // and pool isn't disrupted by user callback errors
      }
    }
    this.callbacks.clear();
  }

  /**
   * Check if cancellation has been requested
   *
   * Returns current cancellation state. Useful for polling-style
   * cancellation checks in loops.
   *
   * Performance: O(1) (simple boolean read)
   *
   * Example:
   * ```typescript
   * while (!context.cancellationToken.isCancellationRequested) {
   *   processItem();
   * }
   * ```
   *
   * @readonly
   * @returns True if cancellation requested, false otherwise
   */
  get isCancellationRequested(): boolean {
    return this.cancelled;
  }

  /**
   * Register cancellation callback
   *
   * Callback invoked immediately if already cancelled, otherwise
   * invoked when cancel() called.
   *
   * Safe to register/unregister callbacks from within callbacks
   * (uses Set iteration which handles modifications).
   *
   * Callback exceptions caught and suppressed to prevent disruption.
   *
   * Performance:
   * - O(1) if already cancelled (direct invocation)
   * - O(1) registration (Set insertion)
   *
   * Example:
   * ```typescript
   * context.cancellationToken.onCancellation(() => {
   *   logger.info('Task cancelled');
   *   connection?.close();
   * });
   * ```
   *
   * @param callback - Function to invoke on cancellation
   *
   * Safe to call multiple times with same callback (each registered once).
   * Callback exceptions silently suppressed.
   * Callbacks execute in registration order.
   */
  onCancellation(callback: () => void): void {
    if (this.cancelled) {
      callback();
      return;
    }
    this.callbacks.add(callback);
  }

  /**
   * Throw error if cancellation requested
   *
   * Asserts that cancellation not requested. Throws WorkerPoolError
   * with TASK_CANCELLED code if cancelled.
   *
   * Useful at function entry points, critical sections, and after
   * potentially long-running operations to fail fast.
   *
   * Performance: O(1)
   *
   * @throws {WorkerPoolError} with code TASK_CANCELLED if already cancelled
   *
   * Example:
   * ```typescript
   * // Guard entry point
   * context.cancellationToken.throwIfCancellationRequested();
   *
   * // Guard loop iteration
   * for (const item of items) {
   *   context.cancellationToken.throwIfCancellationRequested();
   *   processItem(item);
   * }
   * ```
   */
  throwIfCancellationRequested(): void {
    if (this.cancelled) {
      throw new WorkerPoolError("Task has been cancelled", TASK_CANCELLED_CODE);
    }
  }
}

/**
 * Cancellation Token Source
 *
 * Controls cancellation for a task. Application code:
 * 1. Creates source
 * 2. Passes token to worker/handler
 * 3. Calls cancel() to trigger cancellation
 *
 * One source per task execution context.
 * Tokens from same source all cancelled together.
 *
 * Example:
 * ```typescript
 * // In WorkerPoolRuntime task execution
 * const tokenSource = new CancellationTokenSource();
 *
 * // Pass token to handler
 * const context = {
 *   cancellationToken: tokenSource.token,
 *   // ... other context properties
 * };
 *
 * try {
 *   const result = await handler(payload, context);
 *   return result;
 * } finally {
 *   // Cancel on timeout, error, or disposal
 *   if (timeoutExpired) {
 *     tokenSource.cancel();
 *   }
 * }
 * ```
 */
export class CancellationTokenSource {
  /**
   * Internal token implementation
   *
   * Hidden from public API - accessed via token property.
   *
   * @private
   * @readonly
   */
  private readonly tokenImpl = new CancellationTokenImpl();

  /**
   * Get the cancellation token
   *
   * Returns read-only token that can be observed for cancellation.
   * Same token object returned on each access (stable reference).
   *
   * Example:
   * ```typescript
   * const source = new CancellationTokenSource();
   * const token = source.token; // Stable reference
   * assert(token === source.token); // True
   * ```
   *
   * @readonly
   * @returns The cancellation token for observing cancellation
   *
   * @see {@link CancellationToken}
   */
  get token(): CancellationToken {
    return this.tokenImpl;
  }

  /**
   * Request cancellation
   *
   * Transitions token to cancelled state, invoking all registered
   * callbacks. Idempotent - subsequent calls have no effect.
   *
   * Performance: O(n) where n = callbacks registered
   *
   * Example:
   * ```typescript
   * // On timeout
   * timeoutId = setTimeout(() => {
   *   tokenSource.cancel();
   * }, taskTimeout);
   *
   * // On error
   * catch (error) {
   *   tokenSource.cancel(); // Signal to handler
   *   rethrow(error);
   * }
   * ```
   *
   * @see {@link token} to pass token to operations
   */
  cancel(): void {
    this.tokenImpl.cancel();
  }
}

/**
 * Cancellation Error Code
 *
 * Standard code used in WorkerPoolError when task cancelled.
 * Enables programmatic differentiation of cancellation from other errors.
 *
 * Example:
 * ```typescript
 * try {
 *   await pool.execute(task);
 * } catch (error) {
 *   if (error instanceof WorkerPoolError && error.code === CANCELLATION_ERROR_CODE) {
 *     console.log('Task was cancelled');
 *   }
 * }
 * ```
 *
 * @see {@link WorkerPoolError}
 */
export const CANCELLATION_ERROR_CODE = TASK_CANCELLED_CODE;
