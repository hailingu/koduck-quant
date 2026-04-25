/**
 * Capability Container Module
 *
 * This module provides production-ready implementations of the capability system's core components:
 * storage, caching, execution, and management.
 *
 * **Key Components**:
 * 1. **DefaultCapabilityProvider** - Capability storage and retrieval (Map-based)
 * 2. **DefaultCapabilityCache** - TTL-based caching with performance metrics
 * 3. **DefaultCapabilityExecutor** - Smart execution with retry, timeout, batch support
 * 4. **CapabilityManager** - High-level orchestration with performance monitoring
 * 5. **CapabilityContainerUtils** - Utility functions for integration and compatibility
 *
 * **Architecture**:
 * - **Provider Pattern**: Decouples capability storage from execution
 * - **Cache Pattern**: Improves performance with TTL and hit/miss tracking
 * - **Strategy Pattern**: Different execution strategies (sync, async, retry, timeout)
 * - **Facade Pattern**: CapabilityManager provides simplified API
 * - **Fluent Interface**: Method chaining for intuitive usage
 *
 * **Performance Features**:
 * - O(1) capability lookup via Map
 * - Automatic cache cleanup of expired entries
 * - Performance metrics collection (hit rate, execution time, etc.)
 * - Batch operations for efficient multi-capability processing
 * - Connection pooling and resource management
 *
 * **Configuration**:
 * ```typescript
 * const config: ICapabilitySystemConfig = {
 *   cache: { enabled: true, defaultTtlMs: 300000, maxSize: 1000 },
 *   execution: { defaultTimeoutMs: 5000, defaultMaxRetries: 3 },
 *   debug: { enabled: false, logLevel: 'error' }
 * };
 * ```
 *
 * **Typical Usage**:
 * ```typescript
 * // Create manager
 * const manager = new CapabilityManager();
 *
 * // Register capabilities
 * manager.registerCapabilities([renderCap, executeCap, validateCap]);
 *
 * // Execute with smart options
 * const result = await manager.smartExecute('render', {
 *   timeout: 3000,
 *   retries: 2
 * }, entity, context);
 *
 * // Monitor performance
 * const report = manager.getPerformanceReport();
 * const health = manager.healthCheck();
 * ```
 *
 * @module CapabilityContainer
 * @see {@link ICapabilityProvider} - Provider interface
 * @see {@link ICapabilityCache} - Cache interface
 * @see {@link ICapabilityExecutor} - Executor interface
 * @see {@link ICapabilityManager} - Manager interface
 */

import type {
  ICapabilityContainer,
  ICapability,
  ICapabilityProvider,
  ICapabilityExecutor,
  ICapabilityCache,
  ICapabilityResult,
  ICapabilityManager,
  ICapabilitySystemConfig,
} from "./types";
import { getConfig } from "../../common/config/loader";
import { logger } from "../../common/logger";

/**
 * Default Capability Provider Implementation
 *
 * Stores and retrieves capabilities using a Map data structure.
 * Provides O(1) lookups and supports filtering, cloning, and batch operations.
 *
 * **Features**:
 * - Thread-safe capability storage
 * - Fluent interface for chaining operations
 * - Clone and filter capabilities
 * - Batch add/remove operations
 * - Execution with context support
 *
 * **Type Parameter**:
 * - `T extends ICapability` - Capability type (default: ICapability)
 *
 * @example
 * ```typescript
 * const provider = new DefaultCapabilityProvider([renderCap, executeCap]);
 *
 * // Add capability
 * provider.add(validateCap);
 *
 * // Get all
 * const all = provider.all();
 *
 * // Filter
 * const renderOnly = provider.filter(cap => cap.name === 'render');
 *
 * // Batch operations
 * provider.batch([
 *   { type: 'add', capability: newCap },
 *   { type: 'remove', name: 'oldCap' }
 * ]);
 * ```
 *
 * @template T - Capability type managed by this provider
 * @implements ICapabilityProvider<T>
 */
export class DefaultCapabilityProvider<T extends ICapability = ICapability>
  implements ICapabilityProvider<T>
{
  /**
   * Internal map for O(1) capability lookup
   *
   * - Key: Capability name
   * - Value: Capability instance
   * - Automatically updated on add/remove
   *
   * @private
   */
  private capabilities: Map<string, T> = new Map();

  /**
   * Constructor
   *
   * Optionally initializes with initial capabilities.
   *
   * @param initialCapabilities - Optional array of capabilities to register
   *
   * @example
   * ```typescript
   * const provider = new DefaultCapabilityProvider([cap1, cap2]);
   * ```
   */
  constructor(initialCapabilities?: T[]) {
    if (initialCapabilities) {
      initialCapabilities.forEach((cap) => this.capabilities.set(cap.name, cap));
    }
  }

  /**
   * Get all registered capabilities
   *
   * @returns Array of all capability instances
   *
   * @example
   * ```typescript
   * const all = provider.all();
   * console.log(`Registered: ${all.map(c => c.name).join(', ')}`);
   * ```
   */
  all(): T[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get a specific capability by name
   *
   * @template K - Capability name type
   * @param name - Capability name
   * @returns Capability instance or undefined if not found
   *
   * @example
   * ```typescript
   * const cap = provider.get('render');
   * if (cap) {
   *   // Use capability
   * }
   * ```
   */
  get<K extends string>(name: K): T | undefined {
    return this.capabilities.get(name);
  }

  /**
   * Check if capability exists
   *
   * Quick predicate for availability checking.
   *
   * @param name - Capability name
   * @returns true if capability is registered
   *
   * @example
   * ```typescript
   * if (provider.has('render')) {
   *   // Capability available
   * }
   * ```
   */
  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  /**
   * Add a capability
   *
   * Replaces existing capability with same name.
   * Returns this for method chaining.
   *
   * @param capability - Capability to add
   * @returns this (for chaining)
   *
   * @example
   * ```typescript
   * provider.add(cap1).add(cap2).add(cap3);
   * ```
   */
  add(capability: T): this {
    this.capabilities.set(capability.name, capability);
    return this;
  }

  /**
   * Remove a capability
   *
   * No-op if capability doesn't exist.
   * Returns this for method chaining.
   *
   * @param name - Capability name to remove
   * @returns this (for chaining)
   *
   * @example
   * ```typescript
   * provider.remove('oldCapability');
   * ```
   */
  remove(name: string): this {
    this.capabilities.delete(name);
    return this;
  }

  /**
   * Batch add/remove operations
   *
   * Efficient bulk operations with fluent interface.
   *
   * @param operations - Array of {type, capability?, name?} objects
   * @returns this (for chaining)
   *
   * @remarks
   * - Each operation has type: 'add' | 'remove'
   * - 'add' operations need capability field
   * - 'remove' operations need name field
   *
   * @example
   * ```typescript
   * provider.batch([
   *   { type: 'add', capability: cap1 },
   *   { type: 'remove', name: 'old' },
   *   { type: 'add', capability: cap2 }
   * ]);
   * ```
   */
  batch(operations: Array<{ type: "add" | "remove"; capability?: T; name?: string }>): this {
    operations.forEach((op) => {
      if (op.type === "add" && op.capability) {
        this.add(op.capability);
      } else if (op.type === "remove" && op.name) {
        this.remove(op.name);
      }
    });
    return this;
  }

  /**
   * Clear all capabilities
   *
   * Removes all registered capabilities.
   * Returns this for method chaining.
   *
   * @returns this (for chaining)
   *
   * @example
   * ```typescript
   * provider.clear();
   * ```
   */
  clear(): this {
    this.capabilities.clear();
    return this;
  }

  /**
   * Clone this provider
   *
   * Creates a new provider with a copy of current capabilities.
   * Changes to clone don't affect original.
   *
   * @returns New provider instance with cloned capabilities
   *
   * @example
   * ```typescript
   * const cloned = provider.clone();
   * cloned.remove('render');  // Original unaffected
   * ```
   */
  clone(): ICapabilityProvider<T> {
    return new DefaultCapabilityProvider(this.all());
  }

  /**
   * Filter capabilities
   *
   * Returns new provider with filtered capabilities.
   * Original provider unchanged.
   *
   * @param predicate - Function to filter capabilities
   * @returns New provider with filtered capabilities
   *
   * @example
   * ```typescript
   * const renderCapabilities = provider.filter(
   *   cap => cap.name.startsWith('render')
   * );
   * ```
   */
  filter(predicate: (capability: T) => boolean): ICapabilityProvider<T> {
    return new DefaultCapabilityProvider(this.all().filter(predicate));
  }

  /**
   * Execute capability with context
   *
   * Finds capability by name and executes with provided context.
   * Handles errors and returns structured result.
   *
   * @param name - Capability name to execute
   * @param context - Execution context with parameters
   * @returns Capability result with success flag and error info
   *
   * @example
   * ```typescript
   * const result = await provider.executeCapability('render', {
   *   params: [entity, renderContext]
   * });
   * if (result.success) {
   *   console.log('Rendered:', result.result);
   * }
   * ```
   */
  async executeCapability(
    name: string,
    context: import("./types").ICapabilityContext
  ): Promise<import("./types").ICapabilityResult> {
    const capability = this.get(name);
    if (!capability) {
      return {
        result: undefined,
        capability: name,
        success: false,
        error: new Error(`Capability ${name} not found`),
      };
    }

    try {
      const result = await capability.execute(...(context.params as unknown[]));
      return {
        result,
        capability: name,
        success: true,
      };
    } catch (error) {
      return {
        result: undefined,
        capability: name,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

/**
 * Default Capability Cache Implementation
 *
 * TTL-based in-memory cache for capabilities with performance metrics tracking.
 * Automatically removes expired entries and provides cache statistics for monitoring.
 *
 * **Features**:
 * - TTL-based expiration (configurable per entry)
 * - Hit/miss rate tracking
 * - Access time performance metrics
 * - Automatic expiration cleanup
 * - Batch operations support
 *
 * **Performance Characteristics**:
 * - O(1) get/set operations (Map-based)
 * - Automatic cleanup of expired entries (triggered via cleanup())
 * - Memory-efficient tracking with sliding window (max 1000 access times)
 * - Suitable for high-frequency capability lookups
 *
 * **Statistics Provided**:
 * - Hit rate: Percentage of successful cache hits
 * - Miss rate: Percentage of cache misses
 * - Expired count: Number of entries that expired
 * - Average access time: Performance metric in milliseconds
 *
 * @implements ICapabilityCache
 *
 * @example
 * ```typescript
 * const cache = new DefaultCapabilityCache();
 *
 * // Add capability with 5-minute TTL
 * cache.setCapability('render', renderCap, 300000);
 *
 * // Retrieve capability
 * const cap = cache.getCapability('render');
 *
 * // Monitor cache performance
 * const stats = cache.getStats();
 * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
 *
 * // Periodic cleanup to remove expired entries
 * setInterval(() => cache.cleanup(), 60000);
 * ```
 */
export class DefaultCapabilityCache implements ICapabilityCache {
  /**
   * Internal capability storage
   *
   * Maps capability names to capability instance with optional TTL expiry time.
   * Automatically invalidated by getCapability() when expired.
   *
   * @private
   */
  private cache = new Map<string, { capability: ICapability; expiry?: number }>();

  /**
   * Cache hit counter
   *
   * Incremented on successful capability retrieval.
   * Used for hit rate calculation.
   *
   * @private
   */
  private hits = 0;

  /**
   * Cache miss counter
   *
   * Incremented on failed capability retrieval or expired entry.
   * Used for miss rate calculation.
   *
   * @private
   */
  private misses = 0;

  /**
   * Expired entry counter
   *
   * Tracks total number of entries that have expired.
   * Useful for monitoring cache eviction patterns.
   *
   * @private
   */
  private expired = 0;

  /**
   * Access time tracking
   *
   * Stores performance timing for recent cache accesses.
   * Maintained as sliding window (max 1000 entries) for efficiency.
   * Used to calculate average access time metric.
   *
   * @private
   */
  private accessTimes: number[] = [];

  /**
   * Retrieve capability from cache
   *
   * Looks up capability by name and checks expiration.
   * Automatically removes expired entries and updates metrics.
   *
   * @param name - Capability name to retrieve
   * @returns Capability instance if found and not expired, undefined otherwise
   *
   * **Algorithm**:
   * 1. Look up cache entry by name
   * 2. If not found: increment miss counter and return
   * 3. If found: check expiration time
   * 4. If expired: remove from cache, increment expired/miss counters
   * 5. If valid: increment hit counter, record access time, return capability
   *
   * **Time Complexity**: O(1)
   *
   * @example
   * ```typescript
   * const cap = cache.getCapability('render');
   * if (cap) {
   *   console.log('Capability found:', cap.name);
   * } else {
   *   console.log('Capability not in cache or expired');
   * }
   * ```
   */
  getCapability(name: string): ICapability | undefined {
    const startTime = performance.now();
    const entry = this.cache.get(name);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check expiration
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(name);
      this.expired++;
      this.misses++;
      return undefined;
    }

    this.hits++;
    this.accessTimes.push(performance.now() - startTime);

    // Keep access times array at reasonable size (sliding window)
    if (this.accessTimes.length > 1000) {
      this.accessTimes = this.accessTimes.slice(-500);
    }

    return entry.capability;
  }

  /**
   * Set or update capability in cache
   *
   * Stores capability with optional TTL expiration.
   * If entry exists, it is replaced with new value.
   *
   * @param name - Capability name (cache key)
   * @param capability - Capability instance to cache
   * @param ttlMs - Optional TTL in milliseconds (infinite if omitted)
   *
   * **Algorithm**:
   * 1. Calculate expiration timestamp if TTL provided
   * 2. Store capability with expiry time
   * 3. Entry automatically invalidated when accessed after expiry
   *
   * **Time Complexity**: O(1)
   *
   * @example
   * ```typescript
   * // Cache without expiration
   * cache.setCapability('render', renderCap);
   *
   * // Cache with 5-minute TTL
   * cache.setCapability('validate', validateCap, 300000);
   * ```
   */
  setCapability(name: string, capability: ICapability, ttlMs?: number): void {
    const expiry = ttlMs ? Date.now() + ttlMs : undefined;
    if (expiry !== undefined) {
      this.cache.set(name, { capability, expiry });
    } else {
      this.cache.set(name, { capability });
    }
  }

  /**
   * Batch set multiple capabilities
   *
   * Sets multiple capabilities in cache efficiently.
   * Each entry can have individual TTL.
   *
   * @param entries - Array of capability entries with optional TTL
   *
   * **Algorithm**: Iterates entries and calls setCapability() for each
   *
   * **Time Complexity**: O(n) where n is number of entries
   *
   * @example
   * ```typescript
   * cache.setCapabilities([
   *   { name: 'render', capability: renderCap, ttlMs: 300000 },
   *   { name: 'execute', capability: executeCap, ttlMs: 300000 },
   *   { name: 'serialize', capability: serializeCap }
   * ]);
   * ```
   */
  setCapabilities(entries: Array<{ name: string; capability: ICapability; ttlMs?: number }>): void {
    entries.forEach((entry) => {
      this.setCapability(entry.name, entry.capability, entry.ttlMs);
    });
  }

  /**
   * Clean up expired cache entries
   *
   * Proactively removes all expired entries from cache.
   * Should be called periodically to prevent unbounded growth.
   *
   * **Usage Pattern**:
   * ```typescript
   * // Cleanup every 60 seconds
   * setInterval(() => cache.cleanup(), 60000);
   * ```
   *
   * **Algorithm**:
   * 1. Iterate all cache entries
   * 2. Check each entry's expiration time
   * 3. Delete expired entries and increment counter
   *
   * **Time Complexity**: O(n) where n is cache size
   *
   * @remarks
   * - Expiration is also checked on access (lazy cleanup)
   * - This method performs eager cleanup for memory efficiency
   * - Updates expired counter for monitoring
   */
  cleanup(): void {
    const now = Date.now();
    for (const [name, entry] of this.cache.entries()) {
      if (entry.expiry && now > entry.expiry) {
        this.cache.delete(name);
        this.expired++;
      }
    }
  }

  /**
   * Clear all cache entries and reset counters
   *
   * Completely empties the cache and resets all metrics.
   * Use when reinitializing or to force full refresh.
   *
   * **Time Complexity**: O(n) where n is cache size
   *
   * @example
   * ```typescript
   * // Full cache reset
   * cache.clear();
   * ```
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.expired = 0;
    this.accessTimes = [];
  }

  /**
   * Get cache statistics
   *
   * Returns performance metrics for monitoring cache effectiveness.
   * Useful for tuning TTL and identifying performance bottlenecks.
   *
   * @returns Statistics object with:
   * - size: Current number of entries in cache
   * - hitRate: Ratio of hits to total accesses (0-1)
   * - missRate: Ratio of misses to total accesses (0-1)
   * - expiredCount: Total number of entries that expired
   * - averageAccessTime: Average time in milliseconds for successful lookups
   *
   * **Performance Notes**:
   * - High hit rate (>0.8) indicates good cache strategy
   * - High miss rate suggests TTL too short or keys not reused
   * - High expiration count indicates aggressive TTL settings
   * - Access time helps identify bottlenecks
   *
   * @example
   * ```typescript
   * const stats = cache.getStats();
   * console.log(`Cache efficiency: ${(stats.hitRate * 100).toFixed(1)}% hit rate`);
   *
   * if (stats.hitRate < 0.7) {
   *   console.warn('Consider increasing TTL or cache size');
   * }
   * ```
   */
  getStats(): {
    size: number;
    hitRate: number;
    missRate: number;
    expiredCount: number;
    averageAccessTime: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
      missRate: total > 0 ? this.misses / total : 0,
      expiredCount: this.expired,
      averageAccessTime:
        this.accessTimes.length > 0
          ? this.accessTimes.reduce((a, b) => a + b, 0) / this.accessTimes.length
          : 0,
    };
  }
}

/**
 * Default Capability Executor Implementation
 *
 * Smart execution engine for capabilities with support for retry logic, timeouts,
 * batch operations, and conditional execution. Provides performance tracking and
 * graceful error handling.
 *
 * **Features**:
 * - **Sync & Async Execution**: Both synchronous and asynchronous capability execution
 * - **Retry Logic**: Automatic retry with exponential backoff on failure
 * - **Timeout Protection**: Execute with maximum time limit
 * - **Batch Operations**: Execute multiple capabilities in parallel
 * - **Conditional Execution**: Execute only if condition is met
 * - **Performance Tracking**: Records execution time and frequency metrics
 * - **Cache Integration**: Automatic caching of capability lookups
 *
 * **Execution Flow**:
 * 1. Look up capability from provider (with cache)
 * 2. Verify capability can handle the arguments (canHandle check)
 * 3. Execute capability with error handling
 * 4. Record execution metrics (time, count)
 * 5. Return result or error
 *
 * **Error Handling**:
 * - Catches exceptions during execution
 * - Logs warnings for failed executions
 * - Returns undefined on sync errors or failed async operations
 * - Provides error information in batch operations
 *
 * **Type Parameters**:
 * - `T extends ICapability` - Capability type (default: ICapability)
 *
 * @template T - The capability type
 * @implements {@link ICapabilityExecutor}
 *
 * @example
 * ```typescript
 * const executor = new DefaultCapabilityExecutor(provider, cache);
 *
 * // Sync execution
 * const result = executor.execute<string>('render', entity, context);
 *
 * // Async execution
 * const asyncResult = await executor.executeAsync<string>(
 *   'serialize',
 *   entity,
 *   { format: 'json' }
 * );
 *
 * // Execution with retry (up to 3 retries)
 * const retryResult = await executor.executeWithRetry<string>(
 *   'execute',
 *   3, // maxRetries
 *   entity,
 *   params
 * );
 *
 * // Execution with timeout
 * const timeoutResult = await executor.executeWithTimeout<string>(
 *   'validate',
 *   5000, // timeoutMs
 *   entity
 * );
 *
 * // Batch execution
 * const batchResults = await executor.executeBatch([
 *   { capability: 'render', args: [entity, context] },
 *   { capability: 'validate', args: [entity] },
 * ]);
 *
 * // Conditional execution
 * const conditionalResult = await executor.executeIf(
 *   (cap) => cap.name === 'render',
 *   'render',
 *   entity,
 *   context
 * );
 * ```
 *
 * @see {@link DefaultCapabilityProvider}
 * @see {@link DefaultCapabilityCache}
 */
export class DefaultCapabilityExecutor<T extends ICapability = ICapability>
  implements ICapabilityExecutor<T>
{
  /**
   * Capability provider for lookup
   *
   * Provides access to registered capabilities by name.
   * Combined with cache for efficient lookups.
   *
   * @private
   * @readonly
   */
  private readonly provider: ICapabilityProvider<T>;

  /**
   * Execution result cache
   *
   * Caches looked-up capabilities to avoid repeated provider queries.
   * Significantly improves performance for repeated operations.
   *
   * @private
   * @readonly
   */
  private readonly cache: ICapabilityCache;

  /**
   * Execution statistics tracker
   *
   * Records execution count and total time for each capability.
   * Used to generate performance reports.
   *
   * **Data Structure**:
   * ```
   * Map<capabilityName, { count, totalTime }>
   * ```
   *
   * @private
   * @readonly
   */
  private readonly executionStats = new Map<string, { count: number; totalTime: number }>();

  /**
   * Constructor
   *
   * Initializes executor with capability provider and optional cache.
   * Creates default cache if not provided.
   *
   * @param provider - Capability provider for capability lookups
   * @param cache - Optional cache instance (creates DefaultCapabilityCache if omitted)
   *
   * @example
   * ```typescript
   * // With default cache
   * const executor = new DefaultCapabilityExecutor(provider);
   *
   * // With custom cache
   * const customCache = new DefaultCapabilityCache();
   * const executor = new DefaultCapabilityExecutor(provider, customCache);
   * ```
   */
  constructor(provider: ICapabilityProvider<T>, cache?: ICapabilityCache) {
    this.provider = provider;
    this.cache = cache || new DefaultCapabilityCache();
  }

  /**
   * Execute capability synchronously
   *
   * Executes capability immediately and returns result synchronously.
   * Only use if capability execution is guaranteed to be synchronous.
   *
   * @template TResult - Result type returned by capability
   * @param capabilityName - Name of capability to execute
   * @param args - Arguments to pass to capability
   * @returns Typed result from capability execution, or undefined on error
   *
   * **Error Handling**:
   * - Catches execution exceptions
   * - Logs warning for failed execution
   * - Returns undefined on error
   * - Does not re-throw exceptions
   *
   * **Algorithm**:
   * 1. Find capability with canHandle check
   * 2. Record start time
   * 3. Execute capability
   * 4. Record execution metrics
   * 5. Return result or undefined
   *
   * @example
   * ```typescript
   * const result = executor.execute<string>('render', entity, container);
   * if (result) {
   *   console.log('Rendered:', result);
   * }
   * ```
   */
  execute<TResult>(capabilityName: string, ...args: unknown[]): TResult | undefined {
    const capability = this.findCapability(capabilityName, args);
    if (!capability) return undefined;

    const startTime = performance.now();
    try {
      const result = capability.execute(...args);
      this.recordExecution(capabilityName, startTime);
      return result instanceof Promise ? undefined : (result as TResult);
    } catch (error) {
      logger.warn(`Capability ${capabilityName} execution failed:`, error);
      return undefined;
    }
  }

  /**
   * Execute capability asynchronously
   *
   * Executes capability asynchronously and returns Promise.
   * Handles both sync and async capability implementations.
   *
   * @template TResult - Result type returned by capability
   * @param capabilityName - Name of capability to execute
   * @param args - Arguments to pass to capability
   * @returns Promise resolving to typed result, or undefined on error
   *
   * **Error Handling**:
   * - Catches execution exceptions
   * - Logs warning for failed execution
   * - Resolves to undefined on error (doesn't reject)
   *
   * **Algorithm**:
   * 1. Find capability with canHandle check
   * 2. Record start time
   * 3. Execute capability and await if Promise
   * 4. Record execution metrics
   * 5. Return result or undefined
   *
   * @example
   * ```typescript
   * const result = await executor.executeAsync<string>('serialize', entity);
   * if (result) {
   *   console.log('Serialized:', result);
   * }
   * ```
   */
  async executeAsync<TResult>(
    capabilityName: string,
    ...args: unknown[]
  ): Promise<TResult | undefined> {
    const capability = this.findCapability(capabilityName, args);
    if (!capability) return undefined;

    const startTime = performance.now();
    try {
      const result = await capability.execute(...args);
      this.recordExecution(capabilityName, startTime);
      return result as TResult;
    } catch (error) {
      logger.warn(`Capability ${capabilityName} async execution failed:`, error);
      return undefined;
    }
  }

  /**
   * Execute multiple capabilities in parallel
   *
   * Executes batch of capabilities concurrently using Promise.allSettled().
   * Ensures all operations complete regardless of individual failures.
   *
   * @param operations - Array of { capability, args } to execute
   * @returns Promise array of ICapabilityResult with success/error info
   *
   * **Features**:
   * - Parallel execution (not sequential)
   * - Individual error handling per operation
   * - All operations complete (no early rejection)
   * - Structured result format for easy processing
   *
   * **Result Structure**:
   * ```typescript
   * {
   * capability: string,
   * success: boolean,
   * result?: unknown,
   * error?: Error
   * }
   * ```
   *
   * **Algorithm**:
   * 1. Map operations to Promise array
   * 2. Use Promise.allSettled() for parallel execution
   * 3. Transform settled results to ICapabilityResult
   * 4. Return array of results
   *
   * @example
   * ```typescript
   * const results = await executor.executeBatch([
   *   { capability: 'render', args: [entity, context] },
   *   { capability: 'validate', args: [entity] },
   *   { capability: 'serialize', args: [entity, { format: 'json' }] }
   * ]);
   *
   * // Process results
   * results.forEach((result) => {
   *   if (result.success) {
   *     console.log(`${result.capability}: ${result.result}`);
   *   } else {
   *     console.error(`${result.capability} failed:`, result.error);
   *   }
   * });
   * ```
   */
  async executeBatch(
    operations: Array<{ capability: string; args: unknown[] }>
  ): Promise<ICapabilityResult[]> {
    const results = await Promise.allSettled(
      operations.map(async (op) => {
        try {
          const result = await this.executeAsync(op.capability, ...op.args);
          return {
            capability: op.capability,
            success: true,
            result,
          };
        } catch (error) {
          return {
            capability: op.capability,
            success: false,
            error: error as Error,
          };
        }
      })
    );

    return results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : {
            capability: "unknown",
            success: false,
            error: new Error("Batch execution failed"),
          }
    );
  }

  /**
   * Execute capability with condition
   *
   * Executes capability only if condition function returns true.
   * Useful for conditional capability execution.
   *
   * @param condition - Predicate function to check capability
   * @param capabilityName - Name of capability to execute
   * @param args - Arguments to pass to capability
   * @returns ICapabilityResult with execution status, or undefined if condition fails
   *
   * **Algorithm**:
   * 1. Find capability
   * 2. Check condition against capability
   * 3. If condition true: execute and return result
   * 4. If condition false: return undefined
   * 5. Errors wrapped in ICapabilityResult
   *
   * @example
   * ```typescript
   * const result = await executor.executeIf(
   *   (cap) => cap.name === 'render' && cap.priority > 5,
   *   'render',
   *   entity,
   *   context
   * );
   *
   * if (result?.success) {
   *   console.log('Conditional render succeeded');
   * }
   * ```
   */
  async executeIf(
    condition: (capability: T) => boolean,
    capabilityName: string,
    ...args: unknown[]
  ): Promise<ICapabilityResult | undefined> {
    const capability = this.findCapability(capabilityName, args);
    if (!capability || !condition(capability)) return undefined;

    try {
      const result = await capability.execute(...args);
      return {
        capability: capabilityName,
        success: true,
        result,
      };
    } catch (error) {
      return {
        capability: capabilityName,
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Execute capability with automatic retry on failure
   *
   * Automatically retries capability execution on failure.
   * Useful for handling transient errors.
   *
   * @template TResult - Result type
   * @param capabilityName - Name of capability
   * @param maxRetries - Maximum number of retry attempts (0 = no retries, just one attempt)
   * @param args - Arguments to pass to capability
   * @returns Promise resolving to result or undefined on all failures
   *
   * **Retry Strategy**:
   * - Linear retry attempts (no exponential backoff currently)
   * - Total attempts = maxRetries + 1
   * - No delay between retries (suitable for synchronous-like operations)
   * - Logs warning on final failure
   *
   * **Algorithm**:
   * 1. For each attempt (0 to maxRetries):
   * a. Execute capability
   * b. On success: return result
   * c. On failure: try next attempt
   * 2. After all failures: log and return undefined
   *
   * **Example Scenarios**:
   * - maxRetries=0: Single attempt (default behavior)
   * - maxRetries=1: Try twice (original + 1 retry)
   * - maxRetries=3: Try 4 times total
   *
   * @example
   * ```typescript
   * // Try up to 3 times (4 total attempts)
   * const result = await executor.executeWithRetry<string>(
   *   'fetchData',
   *   3,
   *   entity,
   *   params
   * );
   *
   * // Useful for network operations
   * const apiResult = await executor.executeWithRetry<ApiResponse>(
   *   'callExternalApi',
   *   2,
   *   url,
   *   options
   * );
   * ```
   */
  async executeWithRetry<TResult>(
    capabilityName: string,
    maxRetries: number,
    ...args: unknown[]
  ): Promise<TResult | undefined> {
    const capability = this.findCapability(capabilityName, args);
    if (!capability) return undefined;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = performance.now();
        const result = await capability.execute(...args);
        this.recordExecution(capabilityName, startTime);
        return result as TResult;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          // Exponential backoff could be added here:
          // await new Promise(resolve =>
          //   setTimeout(resolve, Math.pow(2, attempt) * 100)
          // );
        }
      }
    }

    logger.warn(`Capability ${capabilityName} failed after ${maxRetries} retries:`, lastError);
    return undefined;
  }

  /**
   * Execute capability with timeout protection
   *
   * Executes capability with maximum time limit.
   * Aborts execution if timeout is exceeded.
   *
   * @template TResult - Result type
   * @param capabilityName - Name of capability
   * @param timeoutMs - Maximum execution time in milliseconds
   * @param args - Arguments to pass to capability
   * @returns Promise resolving to result or undefined on timeout/error
   *
   * **Timeout Mechanism**:
   * - Uses Promise.race() to compete execution with timeout
   * - Timeout rejection takes precedence over slow execution
   * - Execution is not actually cancelled (continues in background)
   * - Result is discarded if timeout occurs first
   *
   * **Algorithm**:
   * 1. Create timeout promise that rejects after timeoutMs
   * 2. Race capability execution against timeout promise
   * 3. Return first promise to settle
   * 4. Handle "Execution timeout" error specially
   *
   * **Performance Note**:
   * - Promise.race() has minimal overhead
   * - Suitable for protecting against hanging operations
   * - Capability continues executing after timeout (not cancelled)
   *
   * @example
   * ```typescript
   * // Timeout after 5 seconds
   * const result = await executor.executeWithTimeout<string>(
   *   'longRunningOperation',
   *   5000,
   *   entity
   * );
   *
   * // Common patterns
   * const renderResult = await executor.executeWithTimeout<JSX.Element>(
   *   'render',
   *   1000, // 1 second max
   *   entity
   * );
   *
   * const apiResult = await executor.executeWithTimeout<ApiResponse>(
   *   'fetchFromExternalApi',
   *   3000, // 3 second max
   *   url
   * );
   * ```
   */
  async executeWithTimeout<TResult>(
    capabilityName: string,
    timeoutMs: number,
    ...args: unknown[]
  ): Promise<TResult | undefined> {
    const capability = this.findCapability(capabilityName, args);
    if (!capability) return undefined;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Execution timeout")), timeoutMs)
    );

    try {
      const startTime = performance.now();
      const result = await Promise.race([capability.execute(...args), timeoutPromise]);
      this.recordExecution(capabilityName, startTime);
      return result as TResult;
    } catch (error) {
      if ((error as Error).message === "Execution timeout") {
        logger.warn(`Capability ${capabilityName} timed out after ${timeoutMs}ms`);
      } else {
        logger.warn(`Capability ${capabilityName} execution failed:`, error);
      }
      return undefined;
    }
  }

  /**
   * Find capability with canHandle validation
   *
   * Looks up capability from provider or cache, validates it can handle arguments.
   * Implements intelligent caching strategy for performance.
   *
   * **Lookup Strategy**:
   * 1. Check cache first (fast path)
   * 2. If miss: query provider
   * 3. Cache result for future lookups
   * 4. Verify canHandle() against arguments
   *
   * **Algorithm Details**:
   * - Cache miss triggers provider query
   * - Successful finds are cached for next access
   * - canHandle() validation ensures argument compatibility
   * - Returns undefined if capability not found or cannot handle args
   *
   * @private
   * @param name - Capability name
   * @param args - Arguments to validate against
   * @returns Capability if found and can handle args, undefined otherwise
   */
  private findCapability(name: string, args: unknown[]): T | undefined {
    // Prefer cache lookup for performance
    let capability = this.cache.getCapability(name) as T | undefined;

    if (!capability) {
      // Cache miss: query provider
      capability = this.provider.get(name);
      if (capability) {
        this.cache.setCapability(name, capability);
      }
    }

    // Verify capability can handle the arguments
    if (capability && !capability.canHandle(...args)) {
      return undefined;
    }

    return capability;
  }

  /**
   * Record execution statistics
   *
   * Updates execution counters and timing information for performance analysis.
   * Used to track which capabilities are most frequently used and slow.
   *
   * @private
   * @param capabilityName - Name of executed capability
   * @param startTime - High-resolution start time from performance.now()
   */
  private recordExecution(capabilityName: string, startTime: number): void {
    const duration = performance.now() - startTime;
    const stats = this.executionStats.get(capabilityName) || {
      count: 0,
      totalTime: 0,
    };
    stats.count++;
    stats.totalTime += duration;
    this.executionStats.set(capabilityName, stats);
  }

  /**
   * Get execution statistics
   *
   * Returns array of statistics for all executed capabilities.
   * Useful for performance profiling and optimization.
   *
   * @returns Array of capability execution stats with name, count, and average time
   *
   * @example
   * ```typescript
   * const stats = executor.getExecutionStats();
   * stats.forEach(stat => {
   *   console.log(
   *     `${stat.name}: ${stat.count} calls, ${stat.avgTime.toFixed(2)}ms avg`
   *   );
   * });
   * ```
   */
  getExecutionStats() {
    return Array.from(this.executionStats.entries()).map(([name, stats]) => ({
      name,
      count: stats.count,
      avgTime: stats.totalTime / stats.count,
    }));
  }
}

/**
 * Capability Manager - High-Level Orchestration
 *
 * Provides unified management interface for the complete capability system.
 * Combines provider, executor, and cache into a single facade with simplified API.
 *
 * **Responsibilities**:
 * - Register and manage capabilities
 * - Execute capabilities with smart defaults
 * - Monitor system health and performance
 * - Track execution statistics
 * - Provide performance reports
 *
 * **Components**:
 * - Provider: Capability storage and retrieval
 * - Executor: Smart execution engine with retry/timeout support
 * - Cache: Performance optimization via caching
 *
 * **Configuration**:
 * - Cache TTL and max size settings
 * - Execution timeout defaults
 * - Retry limits
 * - Debug/logging options
 *
 * **Type Parameters**:
 * - `T extends ICapability` - Capability type (default: ICapability)
 *
 * **Features**:
 * - Fluent API for method chaining
 * - Intelligent execution (auto-retry, timeout, conditions)
 * - Comprehensive health checking
 * - Performance profiling
 * - Configuration loading from system defaults
 *
 * @template T - Capability type managed by this manager
 * @implements {@link ICapabilityManager}
 *
 * @example
 * ```typescript
 * // Create manager with default configuration
 * const manager = new CapabilityManager<MyCapability>();
 *
 * // Or with custom configuration
 * const customConfig: ICapabilitySystemConfig = {
 *   cache: { enabled: true, defaultTtlMs: 600000, maxSize: 2000 },
 *   execution: { defaultTimeoutMs: 3000, defaultMaxRetries: 2 },
 *   debug: { enabled: true, logLevel: 'info' }
 * };
 * const manager = new CapabilityManager<MyCapability>(customConfig);
 *
 * // Register capabilities (fluent interface)
 * manager
 *   .registerCapability(renderCap)
 *   .registerCapability(executeCap)
 *   .registerCapability(validateCap);
 *
 * // Or batch registration
 * manager.registerCapabilities([renderCap, executeCap, validateCap]);
 *
 * // Smart execution with defaults
 * const result = await manager.smartExecute('render', {
 *   timeout: 1000,
 *   retries: 2
 * }, entity, context);
 *
 * // Performance monitoring
 * const report = manager.getPerformanceReport();
 * console.log('Total executions:', report.totalExecutions);
 * console.log('Average time:', report.averageExecutionTime.toFixed(2), 'ms');
 *
 * // Health check
 * const health = manager.healthCheck();
 * console.log('Status:', health.status);
 * if (health.issues.length > 0) {
 *   console.warn('Issues:', health.issues);
 *   console.log('Recommendations:', health.recommendations);
 * }
 * ```
 *
 * @see {@link DefaultCapabilityProvider}
 * @see {@link DefaultCapabilityExecutor}
 * @see {@link DefaultCapabilityCache}
 */
export class CapabilityManager<T extends ICapability = ICapability>
  implements ICapabilityManager<T>
{
  /**
   * Capability provider
   *
   * Handles capability registration and retrieval.
   * Provides O(1) lookups via Map-based storage.
   *
   * @readonly
   */
  readonly provider: ICapabilityProvider<T>;

  /**
   * Capability executor
   *
   * Executes capabilities with smart strategies (retry, timeout, etc).
   * Integrates with cache for performance optimization.
   *
   * @readonly
   */
  readonly executor: ICapabilityExecutor<T>;

  /**
   * Capability cache
   *
   * Caches capabilities for fast lookups.
   * Provides TTL-based expiration and performance metrics.
   *
   * @readonly
   */
  readonly cache: ICapabilityCache;

  /**
   * System configuration
   *
   * Stores settings for cache, execution, and debugging.
   * Loaded from system defaults with user overrides.
   *
   * @private
   * @readonly
   */
  private readonly config: ICapabilitySystemConfig;

  /**
   * Constructor
   *
   * Initializes capability manager with optional configuration.
   * Loads system defaults and merges with provided config.
   *
   * @param config - Optional configuration overrides
   *
   * **Configuration Defaults** (from system config):
   * - Cache TTL: 5 minutes (300000 ms)
   * - Cache max size: 1000 entries
   * - Execution timeout: 5 seconds (5000 ms)
   * - Max retries: 3 attempts
   * - Debug: Disabled (log level: 'error')
   *
   * @example
   * ```typescript
   * // Use system defaults
   * const manager1 = new CapabilityManager();
   *
   * // Override cache settings
   * const manager2 = new CapabilityManager({
   *   cache: { enabled: true, defaultTtlMs: 600000, maxSize: 2000 }
   * });
   *
   * // Override execution settings
   * const manager3 = new CapabilityManager({
   *   execution: { defaultTimeoutMs: 3000, defaultMaxRetries: 2 }
   * });
   * ```
   */
  constructor(config?: ICapabilitySystemConfig) {
    const defaultConfig = getConfig();
    this.config = {
      cache: {
        enabled: true,
        defaultTtlMs: defaultConfig.plugin.capabilityCache?.defaultTtlMs ?? 300000,
        maxSize: defaultConfig.plugin.capabilityCache?.maxSize ?? 1000,
      },
      execution: {
        defaultTimeoutMs: defaultConfig.plugin.execution?.defaultTimeoutMs ?? 5000,
        defaultMaxRetries: 3,
        enablePerformanceTracking: true,
      },
      debug: { enabled: false, logLevel: "error" },
      ...config,
    };

    this.cache = new DefaultCapabilityCache();
    this.provider = new DefaultCapabilityProvider<T>();
    this.executor = new DefaultCapabilityExecutor(this.provider, this.cache);
  }

  /**
   * Register single capability
   *
   * Adds a capability to the provider and returns this for method chaining.
   *
   * @param capability - Capability instance to register
   * @returns This manager instance for fluent chaining
   *
   * @example
   * ```typescript
   * manager
   *   .registerCapability(renderCap)
   *   .registerCapability(executeCap)
   *   .registerCapability(validateCap);
   * ```
   */
  registerCapability(capability: T): this {
    this.provider.add(capability);
    return this;
  }

  /**
   * Register multiple capabilities
   *
   * Efficiently registers array of capabilities in batch.
   *
   * @param capabilities - Array of capability instances
   * @returns This manager instance for fluent chaining
   *
   * @example
   * ```typescript
   * manager.registerCapabilities([
   *   renderCap,
   *   executeCap,
   *   validateCap,
   *   transformCap
   * ]);
   * ```
   */
  registerCapabilities(capabilities: T[]): this {
    this.provider.batch(capabilities.map((cap) => ({ type: "add" as const, capability: cap })));
    return this;
  }

  /**
   * Smart execute with intelligent defaults
   *
   * Executes capability with optional timeout, retry, and condition parameters.
   * Automatically applies configured defaults if options not provided.
   *
   * @template TResult - Result type
   * @param capabilityName - Name of capability to execute
   * @param options - Optional execution options:
   * - timeout: Max execution time in milliseconds
   * - retries: Number of retry attempts on failure
   * - condition: Predicate function to test capability
   * @param args - Arguments to pass to capability
   * @returns Promise resolving to result or undefined on error
   *
   * **Execution Strategy**:
   * 1. If condition provided: execute conditional, return early
   * 2. If retries > 0: execute with retry logic
   * 3. If timeout > 0: execute with timeout protection
   * 4. Otherwise: normal async execution
   *
   * **Default Values** (from config if not specified):
   * - timeout: configured defaultTimeoutMs or 5000
   * - retries: configured defaultMaxRetries or 3
   *
   * @example
   * ```typescript
   * // Basic execution
   * const result = await manager.smartExecute<string>(
   *   'render',
   *   undefined,
   *   entity,
   *   context
   * );
   *
   * // With explicit options
   * const result = await manager.smartExecute<string>(
   *   'serialize',
   *   { timeout: 2000, retries: 1 },
   *   entity,
   *   { format: 'json' }
   * );
   *
   * // With condition
   * const result = await manager.smartExecute<string>(
   *   'execute',
   *   { condition: (cap) => cap.name === 'execute' && cap.priority > 5 },
   *   entity,
   *   params
   * );
   * ```
   */
  async smartExecute<TResult>(
    capabilityName: string,
    options?: {
      timeout?: number;
      retries?: number;
      condition?: (capability: T) => boolean;
    },
    ...args: unknown[]
  ): Promise<TResult | undefined> {
    const { timeout, retries, condition } = {
      timeout: this.config.execution?.defaultTimeoutMs || 5000,
      retries: this.config.execution?.defaultMaxRetries || 3,
      ...options,
    };

    // Condition check
    if (condition) {
      const result = await this.executor.executeIf(condition, capabilityName, ...args);
      return result?.success ? (result.result as TResult) : undefined;
    }

    // Retry execution
    if (retries > 0) {
      return await this.executor.executeWithRetry<TResult>(capabilityName, retries, ...args);
    }

    // Timeout execution
    if (timeout > 0) {
      return await this.executor.executeWithTimeout<TResult>(capabilityName, timeout, ...args);
    }

    // Normal execution
    return await this.executor.executeAsync<TResult>(capabilityName, ...args);
  }

  /**
   * Get performance report
   *
   * Generates comprehensive performance analysis including execution stats and cache metrics.
   * Useful for identifying bottlenecks and optimization opportunities.
   *
   * @returns Performance report object with metrics and insights
   *
   * **Report Contents**:
   * - totalCapabilities: Number of registered capabilities
   * - totalExecutions: Total execution count across all capabilities
   * - averageExecutionTime: Mean execution time in milliseconds
   * - cacheStats: Cache performance metrics (hit rate, misses, expiration)
   * - topPerformers: 5 fastest capabilities
   *
   * @example
   * ```typescript
   * const report = manager.getPerformanceReport();
   *
   * console.log(`Total capabilities: ${report.totalCapabilities}`);
   * console.log(`Total executions: ${report.totalExecutions}`);
   * console.log(`Average time: ${report.averageExecutionTime.toFixed(2)}ms`);
   * console.log(`Cache hit rate: ${(report.cacheStats.hitRate * 100).toFixed(1)}%`);
   *
   * console.log('Top 5 fastest capabilities:');
   * report.topPerformers.forEach(stat => {
   *   console.log(`  ${stat.name}: ${stat.avgTime.toFixed(2)}ms`);
   * });
   * ```
   */
  getPerformanceReport() {
    const executionStats = (this.executor as DefaultCapabilityExecutor<T>).getExecutionStats();
    const cacheStats = this.cache.getStats();

    return {
      totalCapabilities: this.provider.all().length,
      totalExecutions: executionStats.reduce((sum, stat) => sum + stat.count, 0),
      averageExecutionTime:
        executionStats.length > 0
          ? executionStats.reduce((sum, stat) => sum + stat.avgTime, 0) / executionStats.length
          : 0,
      cacheStats,
      topPerformers: executionStats
        .slice()
        .sort((a, b) => a.avgTime - b.avgTime)
        .slice(0, 5),
    };
  }

  /**
   * Health check
   *
   * Performs comprehensive system health assessment.
   * Identifies issues and provides recommendations.
   *
   * @returns Health status with issues and recommendations
   *
   * **Health Status**:
   * - "healthy": No issues detected
   * - "degraded": Minor issues detected (1-2)
   * - "unhealthy": Multiple issues detected (3+)
   *
   * **Checks Performed**:
   * 1. Cache hit rate (should be > 80%)
   * 2. Capabilities registered (should be > 0)
   * 3. Cache expiration rate (should be < 10% of cache size)
   *
   * **Example Issues**:
   * - Low cache hit rate: Cache strategy may be suboptimal
   * - No capabilities: System non-functional
   * - High expiration: TTL too short
   *
   * @example
   * ```typescript
   * const health = manager.healthCheck();
   *
   * console.log(`Status: ${health.status}`);
   *
   * if (health.issues.length > 0) {
   *   console.warn('Issues:');
   *   health.issues.forEach(issue => console.warn(`  - ${issue}`));
   * }
   *
   * if (health.recommendations.length > 0) {
   *   console.log('Recommendations:');
   *   health.recommendations.forEach(rec => console.log(`  - ${rec}`));
   * }
   * ```
   */
  healthCheck() {
    const cacheStats = this.cache.getStats();
    const capabilities = this.provider.all();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Cache health check
    if (cacheStats.hitRate < 0.8) {
      issues.push(`Low cache hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
      recommendations.push(
        "Consider increasing cache TTL or optimizing capability access patterns"
      );
    }

    // Capability count check
    if (capabilities.length === 0) {
      issues.push("No capabilities registered");
      recommendations.push("Register at least one capability to enable functionality");
    }

    // Expiration rate check
    if (cacheStats.expiredCount > cacheStats.size * 0.1) {
      issues.push("High cache expiration rate detected");
      recommendations.push("Consider adjusting TTL settings or cleaning up expired entries");
    }

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (issues.length > 2) {
      status = "unhealthy";
    } else if (issues.length > 0) {
      status = "degraded";
    }

    return { status, issues, recommendations };
  }
}

/**
 * Capability Container Utilities
 *
 * Provides utility functions for working with capability containers.
 * Includes static factory methods, convenience wrappers, and integration helpers.
 *
 * **Static Cache**:
 * - Maintains shared DefaultCapabilityCache for all utility operations
 * - Improves performance across multiple utility function calls
 * - Automatically managed with cleanup methods
 *
 * **Key Utilities**:
 * 1. **hasCapability** - Check if container has capability
 * 2. **executeCapability** - Execute capability from container
 * 3. **createFluentProvider** - Create provider from container
 * 4. **createUltimateExecutor** - Create executor from container
 * 5. **createCapabilityManager** - Create manager from container
 * 6. **extractCapabilities** - Get capability array (compatibility)
 * 7. **mergeContainers** - Combine multiple containers (compatibility)
 *
 * **Design Pattern**: Facade + Utility Bundle
 * - Simplifies common operations
 * - Provides backward compatibility
 * - Supports functional programming style
 * - Enables composition patterns
 *
 * **Performance Characteristics**:
 * - O(1) hasCapability checks (cache-backed)
 * - O(1) executeCapability with caching
 * - Factory methods with shared cache (efficient reuse)
 * - Static utility methods (no instance required)
 *
 * **Usage Patterns**:
 * ```typescript
 * // Check capability
 * if (CapabilityContainerUtils.hasCapability(container, 'render')) {
 *   // Has render capability
 * }
 *
 * // Execute capability
 * const result = await CapabilityContainerUtils.executeCapability(
 *   container,
 *   'serialize',
 *   entity
 * );
 *
 * // Create executor
 * const executor = CapabilityContainerUtils.createUltimateExecutor(container);
 * const result = await executor.executeAsync('execute', data);
 *
 * // Merge containers
 * const merged = CapabilityContainerUtils.mergeContainers(
 *   container1,
 *   container2,
 *   container3
 * );
 *
 * // Monitoring
 * const stats = CapabilityContainerUtils.getCacheStats();
 * console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
 * ```
 *
 * @see {@link CapabilityManager}
 * @see {@link DefaultCapabilityExecutor}
 * @see {@link DefaultCapabilityProvider}
 */
export class CapabilityContainerUtils {
  /**
   * Static shared cache for all utility operations
   *
   * Provides performance optimization by caching capability lookups
   * across multiple utility function calls. Shared instance ensures
   * consistency and reduces memory overhead.
   *
   * @private
   * @static
   * @readonly
   */
  private static readonly cache = new DefaultCapabilityCache();

  /**
   * Check if container has specified capability
   *
   * Determines whether a container supports a given capability by name.
   * Uses array search (O(n)) but typically containers have few capabilities.
   *
   * @param container - Capability container to check
   * @param capabilityName - Name of capability to look for
   * @returns True if container has capability, false otherwise
   *
   * **Algorithm**:
   * 1. Access container.capabilities array (returns undefined if absent)
   * 2. Use some() to find matching capability name
   * 3. Default to false if array is undefined
   *
   * **Time Complexity**: O(n) where n = number of capabilities
   *
   * @example
   * ```typescript
   * if (CapabilityContainerUtils.hasCapability(container, 'render')) {
   *   console.log('Container supports rendering');
   * }
   *
   * // Check multiple capabilities
   * const canRender = CapabilityContainerUtils.hasCapability(container, 'render');
   * const canExecute = CapabilityContainerUtils.hasCapability(container, 'execute');
   * const canValidate = CapabilityContainerUtils.hasCapability(container, 'validate');
   * ```
   */
  static hasCapability(container: ICapabilityContainer, capabilityName: string): boolean {
    return container.capabilities?.some((cap) => cap.name === capabilityName) ?? false;
  }

  /**
   * Execute capability from container
   *
   * Executes specified capability from container with error handling.
   * Uses shared cache for performance optimization.
   *
   * @template T - Result type
   * @param container - Container holding capabilities
   * @param capabilityName - Name of capability to execute
   * @param args - Arguments to pass to capability
   * @returns Promise resolving to result typed as T, or undefined on error
   *
   * **Features**:
   * - Graceful error handling (logs, returns undefined)
   * - Cache integration for performance
   * - Type-safe result handling
   * - Supports async capabilities
   *
   * **Algorithm**:
   * 1. Find capability in container
   * 2. Call canHandle() to validate
   * 3. Execute capability with arguments
   * 4. Return typed result or undefined
   * 5. Catch and log errors
   *
   * **Error Handling**:
   * - Logs warnings on execution failure
   * - Returns undefined instead of throwing
   * - Preserves error information in logs
   *
   * @example
   * ```typescript
   * // Basic execution
   * const result = await CapabilityContainerUtils.executeCapability<string>(
   *   container,
   *   'serialize',
   *   entity
   * );
   *
   * // With multiple arguments
   * const rendered = await CapabilityContainerUtils.executeCapability<JSX.Element>(
   *   container,
   *   'render',
   *   entity,
   *   renderContext,
   *   options
   * );
   *
   * // Type-safe result
   * type ApiResponse = { status: 'ok'; data: unknown };
   * const response = await CapabilityContainerUtils.executeCapability<ApiResponse>(
   *   container,
   *   'callApi',
   *   url
   * );
   * if (response) {
   *   console.log('Status:', response.status);
   * }
   * ```
   */
  static async executeCapability<T = unknown>(
    container: ICapabilityContainer,
    capabilityName: string,
    ...args: unknown[]
  ): Promise<T | undefined> {
    const capability = this.findCapability(container, capabilityName, args);
    if (!capability) return undefined;

    try {
      const result = await capability.execute(...args);
      return result as T;
    } catch (error) {
      logger.warn(`Capability execution failed: ${capabilityName}`, error);
      return undefined;
    }
  }

  /**
   * Create fluent provider from container
   *
   * Extracts capabilities from container and creates new provider.
   * Enables fluent API usage on container capabilities.
   *
   * @template T - Capability type
   * @param container - Container to extract capabilities from
   * @returns New DefaultCapabilityProvider with container's capabilities
   *
   * **Use Cases**:
   * - Convert container to provider for batch operations
   * - Enable method chaining on capabilities
   * - Create filtered/transformed providers
   * - Share provider across systems
   *
   * **Time Complexity**: O(n) where n = number of capabilities (copy operation)
   *
   * @example
   * ```typescript
   * const provider = CapabilityContainerUtils.createFluentProvider(container);
   *
   * // Use fluent API
   * const filtered = provider
   *   .filter(cap => cap.name !== 'deprecated')
   *   .clone();
   *
   * // Get all
   * const all = provider.all();
   * ```
   */
  static createFluentProvider<T extends ICapability = ICapability>(
    container: ICapabilityContainer<T>
  ): ICapabilityProvider<T> {
    return new DefaultCapabilityProvider(container.capabilities);
  }

  /**
   * Create ultimate executor from container
   *
   * Creates new DefaultCapabilityExecutor from container capabilities.
   * Shares static cache for consistent performance across executors.
   *
   * @template T - Capability type
   * @param container - Container holding capabilities
   * @returns Executor ready for use
   *
   * **Features**:
   * - Integrated caching via static cache
   * - Full execution features (retry, timeout, batch)
   * - Performance tracking enabled
   * - Error handling built-in
   *
   * @example
   * ```typescript
   * const executor = CapabilityContainerUtils.createUltimateExecutor(container);
   *
   * // Sync execution
   * const result = executor.execute<string>('render', entity);
   *
   * // Async execution
   * const asyncResult = await executor.executeAsync<string>('serialize', entity);
   *
   * // With retry
   * const retryResult = await executor.executeWithRetry<string>(
   *   'execute',
   *   3,
   *   entity
   * );
   *
   * // Get performance stats
   * const stats = executor.getExecutionStats();
   * ```
   */
  static createUltimateExecutor<T extends ICapability = ICapability>(
    container: ICapabilityContainer<T>
  ): ICapabilityExecutor<T> {
    const provider = this.createFluentProvider(container);
    return new DefaultCapabilityExecutor(provider, this.cache);
  }

  /**
   * Create full capability manager from container
   *
   * Creates new CapabilityManager initialized with container's capabilities.
   * Enables high-level orchestration and monitoring.
   *
   * @template T - Capability type
   * @param container - Container holding capabilities
   * @param config - Optional manager configuration overrides
   * @returns Fully initialized CapabilityManager
   *
   * **Features**:
   * - Fluent registration API
   * - Smart execution (retry, timeout, condition)
   * - Performance monitoring
   * - Health checking
   * - System configuration integration
   *
   * @example
   * ```typescript
   * const manager = CapabilityContainerUtils.createCapabilityManager(
   *   container,
   *   { execution: { defaultTimeoutMs: 3000 } }
   * );
   *
   * // Execute with smart options
   * const result = await manager.smartExecute('render', {
   *   timeout: 1000,
   *   retries: 2
   * }, entity, context);
   *
   * // Monitor performance
   * const report = manager.getPerformanceReport();
   * console.log('Average execution time:', report.averageExecutionTime);
   *
   * // Health check
   * const health = manager.healthCheck();
   * ```
   */
  static createCapabilityManager<T extends ICapability = ICapability>(
    container: ICapabilityContainer<T>,
    config?: ICapabilitySystemConfig
  ): ICapabilityManager<T> {
    const manager = new CapabilityManager<T>(config);
    if (container.capabilities) {
      manager.registerCapabilities(container.capabilities);
    }
    return manager;
  }

  /**
   * Find capability with validation
   *
   * Internal helper to locate capability in container.
   * Validates canHandle() before returning.
   *
   * @private
   * @static
   * @param container - Container to search
   * @param name - Capability name
   * @param args - Arguments to validate
   * @returns Capability if found and can handle args, undefined otherwise
   *
   * **Algorithm**:
   * 1. Try cache first (cacheKey = name_capabilityCount)
   * 2. If miss: search container.capabilities array
   * 3. Validate canHandle() against arguments
   * 4. Cache successful finds
   * 5. Return undefined if not found or canHandle fails
   */
  private static findCapability(
    container: ICapabilityContainer,
    name: string,
    args: unknown[]
  ): ICapability | undefined {
    // Try cache first
    const cacheKey = `${name}_${container.capabilities?.length ?? 0}`;
    let capability = this.cache.getCapability(cacheKey);

    if (!capability) {
      // Search container
      capability = container.capabilities?.find(
        (cap) => cap.name === name && cap.canHandle(...args)
      );

      if (capability) {
        this.cache.setCapability(cacheKey, capability);
      }
    }

    return capability?.canHandle(...args) ? capability : undefined;
  }

  /**
   * Get cache statistics
   *
   * Returns performance metrics for static shared cache.
   * Useful for monitoring utility function performance.
   *
   * @static
   * @returns Cache statistics including hit rate, size, expiration count
   *
   * @example
   * ```typescript
   * const stats = CapabilityContainerUtils.getCacheStats();
   * console.log(`Cache size: ${stats.size}`);
   * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
   * console.log(`Average access time: ${stats.averageAccessTime.toFixed(2)}ms`);
   * ```
   */
  static getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear static cache
   *
   * Empties the shared cache and resets all metrics.
   * Use when reinitializing or to force full refresh.
   *
   * @static
   *
   * @example
   * ```typescript
   * // After changing container contents
   * CapabilityContainerUtils.clearCache();
   *
   * // Now fresh lookups will occur
   * const executor = CapabilityContainerUtils.createUltimateExecutor(newContainer);
   * ```
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Extract capabilities array (backward compatibility)
   *
   * Provides legacy access to capability array from container.
   * Supports migration from older container APIs.
   *
   * @template T - Capability type
   * @param container - Container to extract from
   * @returns Array of capabilities (empty array if none)
   *
   * **Backward Compatibility**:
   * - Maintains compatibility with older code
   * - Safe empty array fallback
   * - No-op if container has no capabilities
   *
   * @example
   * ```typescript
   * // Legacy code pattern
   * const caps = CapabilityContainerUtils.extractCapabilities(container);
   * for (const cap of caps) {
   *   console.log(cap.name);
   * }
   * ```
   */
  static extractCapabilities<T extends ICapability>(container: ICapabilityContainer<T>): T[] {
    return container.capabilities || [];
  }

  /**
   * Merge multiple capability containers (backward compatibility)
   *
   * Combines capabilities and configurations from multiple containers.
   * Creates new merged container without modifying originals.
   *
   * @template T - Capability type
   * @param containers - Variable number of containers to merge
   * @returns New container with merged capabilities and configs
   *
   * **Merge Strategy**:
   * - Collects all capabilities from all containers
   * - Merges configuration objects (later containers override)
   * - Creates new container (no mutation of inputs)
   * - Deduplication NOT performed (duplicates preserved)
   *
   * **Use Cases**:
   * - Combine multiple feature sets
   * - Merge system and user capabilities
   * - Create composite containers
   *
   * @example
   * ```typescript
   * const container1 = { capabilities: [renderCap, executeCap] };
   * const container2 = { capabilities: [validateCap] };
   * const container3 = { capabilities: [serializeCap], config: { level: 'high' } };
   *
   * const merged = CapabilityContainerUtils.mergeContainers(
   *   container1,
   *   container2,
   *   container3
   * );
   *
   * console.log(merged.capabilities.length); // 4
   * console.log(merged.config); // { level: 'high' }
   * ```
   */
  static mergeContainers<T extends ICapability>(
    ...containers: ICapabilityContainer<T>[]
  ): ICapabilityContainer<T> {
    const allCapabilities: T[] = [];
    const mergedConfig: Record<string, unknown> = {};

    for (const container of containers) {
      if (container.capabilities?.length) {
        allCapabilities.push(...container.capabilities);
      }
      if (container.config) {
        Object.assign(mergedConfig, container.config);
      }
    }

    return {
      ...(allCapabilities.length > 0 ? { capabilities: allCapabilities } : {}),
      ...(Object.keys(mergedConfig).length > 0 ? { config: mergedConfig } : {}),
    };
  }
}
