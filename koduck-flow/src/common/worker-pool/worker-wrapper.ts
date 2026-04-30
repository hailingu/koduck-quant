/**
 * Worker Wrapper Module
 *
 * Encapsulates the native Worker API (Web Workers or Worker Threads)
 * and provides a consistent interface for message passing, error handling, and lifecycle management.
 *
 * ## Responsibilities
 *
 * - **API Abstraction**: Wraps both Web Workers and Node.js Worker Threads with unified interface
 * - **Message Protocol**: Implements worker communication protocol with type-safe message handling
 * - **Error Handling**: Catches uncaught errors and properly propagates them to parent
 * - **Lifecycle Management**: Handles worker creation, initialization, termination
 * - **State Tracking**: Maintains worker state and activity timestamps
 * - **Message Queueing**: Buffers messages before worker is ready
 *
 * ## Platform Support
 *
 * Designed to work with:
 * - **Browser**: Web Workers API (dedicated workers)
 * - **Node.js**: worker_threads module
 * - Fallback handling for unsupported environments
 *
 * ## Message Protocol
 *
 * Worker sends messages in format:
 * ```typescript
 * {
 *   type: 'result' | 'error' | 'progress' | 'pong',
 *   id?: string,           // Task ID
 *   data?: unknown,        // Result data
 *   error?: Error,         // Error object (serialized)
 *   progress?: number,     // Progress 0-100
 *   duration?: number,     // Execution time
 *   timestamp: number      // Message timestamp
 * }
 * ```
 *
 * Main thread sends:
 * ```typescript
 * {
 *   type: 'task' | 'terminate' | 'ping',
 *   id?: string,
 *   data?: unknown,
 *   timestamp: number
 * }
 * ```
 *
 * ## State Machine
 *
 * ```
 * [Created] -> [Ready] -> [Active] -> [Ready]
 *                  \       /
 *                  [Error] -> [Terminated]
 * ```
 *
 * @example
 * ```typescript
 * // Create wrapper for worker
 * const wrapper = new WorkerWrapper('worker-1', config);
 *
 * // Setup message handler
 * wrapper.onMessage((msg) => {
 *   if (msg.type === 'result') {
 *     console.log('Task result:', msg.data);
 *   }
 * });
 *
 * // Setup error handler
 * wrapper.onError((error) => {
 *   console.error('Worker error:', error);
 * });
 *
 * // Send message to worker
 * await wrapper.postMessage({ type: 'task', id: 'task-1', data: {...} });
 *
 * // Cleanup
 * await wrapper.terminate();
 * ```
 *
 * @see {@link WorkerPoolCore} for pool management
 */

import type { WorkerPoolConfig } from "./types";

type WorkerEventHandler = (event: { data: WorkerMessage }) => void;
type WorkerErrorHandler = (event: { message: string }) => void;
type WorkerLike = {
  postMessage(message: MainThreadMessage, transfers?: Transferable[]): void;
  terminate(): void | Promise<void>;
  onmessage?: WorkerEventHandler | null;
  onerror?: WorkerErrorHandler | null;
};

type NodeWorkerLike = WorkerLike & {
  on(event: "message", handler: (message: WorkerMessage) => void): void;
  on(event: "error", handler: (error: Error) => void): void;
  on(event: "exit", handler: (code: number) => void): void;
};

type NodeWorkerConstructorLike = new (scriptUrl: string | URL) => NodeWorkerLike;

/**
 * Worker message types that can be sent from worker to main thread
 */
export interface WorkerMessage {
  /** Message type identifier */
  type: "result" | "error" | "progress" | "pong";

  /** Associated task ID */
  id?: string;

  /** Result or error data */
  data?: unknown;

  /** Serialized error information */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };

  /** Progress percentage (0-100) for long tasks */
  progress?: number;

  /** Task execution duration in milliseconds */
  duration?: number;

  /** Message timestamp */
  timestamp: number;
}

/**
 * Main thread message sent to worker
 */
export interface MainThreadMessage {
  /** Message type */
  type: "task" | "terminate" | "ping";

  /** Task or message ID */
  id?: string;

  /** Task data or message payload */
  data?: unknown;

  /** Message timestamp */
  timestamp: number;
}

/**
 * Message handler callback signature
 */
export type MessageHandler = (message: WorkerMessage) => void;

/**
 * Error handler callback signature
 */
export type ErrorHandler = (error: Error) => void;

/**
 * Worker Wrapper - Unified API for worker communication
 *
 * Provides a consistent interface for both Web Workers and Node.js Worker Threads.
 */
export class WorkerWrapper {
  /** Unique worker identifier */
  private readonly workerId: string;

  /** Configuration reference */
  private readonly config: WorkerPoolConfig;

  /** Native worker instance (Worker or Worker Thread) */
  private worker: WorkerLike | undefined;

  /** Message handlers */
  private readonly messageHandlers = new Set<MessageHandler>();

  /** Error handlers */
  private readonly errorHandlers = new Set<ErrorHandler>();

  /** Message queue for buffering before ready */
  private readonly messageQueue: MainThreadMessage[] = [];

  /** Worker ready flag */
  private ready = false;

  /** Worker terminated flag */
  private terminated = false;

  /** Last activity timestamp */
  private lastActivityAt = Date.now();

  /**
   * Create a new worker wrapper
   *
   * @param workerId - Unique identifier for this worker
   * @param config - Worker pool configuration
   */
  constructor(workerId: string, config: WorkerPoolConfig) {
    this.workerId = workerId;
    this.config = config;
    this.initializeWorker();
  }

  /**
   * Initialize the native worker
   *
   * Creates either a Web Worker or Worker Thread depending on environment.
   * Sets up message and error event handlers.
   *
   * @private
   */
  private initializeWorker(): void {
    try {
      this.initializeWebWorker();
    } catch {
      try {
        this.initializeWorkerThread();
      } catch (error) {
        const err = error instanceof Error ? error : new TypeError(String(error));
        this.handleError(err);
      }
    }

    this.ready = true;
  }

  /**
   * Initialize a Web Worker
   *
   * @private
   */
  private initializeWebWorker(): void {
    try {
      // Create default worker if no script specified
      const scriptUrl = this.config.handlers
        ? new URL("./workers/default-worker.ts", import.meta.url).href
        : "./worker.js";

      const worker = new Worker(scriptUrl, { type: "module" });
      this.worker = worker as unknown as WorkerLike;

      // Setup message handler
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleMessage(event.data);
      };

      // Setup error handler
      worker.onerror = (event: ErrorEvent) => {
        const error = new Error(event.message);
        this.handleError(error);
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.handleError(err);
    }
  }

  /**
   * Initialize a Node.js Worker Thread
   *
   * @private
   */
  private initializeWorkerThread(): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Worker } = require("node:worker_threads") as { Worker: NodeWorkerConstructorLike };

    const scriptUrl = this.config.handlers
      ? "./dist/common/worker-pool/workers/default-worker.js"
      : "./worker.js";

    const worker = new Worker(scriptUrl);
    this.worker = worker;

    // Setup message handler
    worker.on("message", (message: WorkerMessage) => {
      this.handleMessage(message);
    });

    // Setup error handler
    worker.on("error", (error: Error) => {
      this.handleError(error);
    });

    // Setup exit handler
    worker.on("exit", (code: number) => {
      if (code !== 0) {
        const error = new Error(`Worker thread exited with code ${code}`);
        this.handleError(error);
      }
    });
  }

  /**
   * Register a message handler
   *
   * Handlers are called for each message received from the worker.
   * Multiple handlers can be registered.
   *
   * @param handler - Callback function for messages
   * @returns Unsubscribe function to remove handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Register an error handler
   *
   * Handlers are called when worker encounters an error.
   * Multiple handlers can be registered.
   *
   * @param handler - Callback function for errors
   * @returns Unsubscribe function to remove handler
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  /**
   * Send a message to the worker
   *
   * Messages are queued if worker is not yet ready.
   * Transfers ownership for Transferable objects to avoid copying.
   *
   * @param message - Message to send
   * @param transfers - Optional array of transferable objects
   *
   * @throws Error if worker has been terminated
   */
  async postMessage(message: MainThreadMessage, transfers?: Transferable[]): Promise<void> {
    if (this.terminated) {
      throw new Error(`Worker ${this.workerId} has been terminated`);
    }

    if (!this.ready) {
      this.messageQueue.push(message);
      return;
    }

    this.lastActivityAt = Date.now();

    try {
      if (!this.worker) {
        throw new Error(`Worker ${this.workerId} is not initialized`);
      }

      if (transfers && transfers.length > 0) {
        this.worker.postMessage(message, transfers);
      } else {
        this.worker.postMessage(message);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.handleError(err);
    }
  }

  /**
   * Flush queued messages to worker
   *
   * Called when worker becomes ready to process all buffered messages.
   *
   * @private
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ready) {
      const message = this.messageQueue.shift()!;
      try {
        if (!this.worker) {
          throw new Error(`Worker ${this.workerId} is not initialized`);
        }
        this.worker.postMessage(message);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.handleError(err);
      }
    }
  }

  /**
   * Handle message from worker
   *
   * Dispatches to all registered message handlers.
   *
   * @param message - Message received from worker
   * @private
   */
  private handleMessage(message: WorkerMessage): void {
    this.lastActivityAt = Date.now();

    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in message handler for worker ${this.workerId}:`, error);
      }
    }
  }

  /**
   * Handle error from worker
   *
   * Dispatches to all registered error handlers.
   *
   * @param error - Error from worker
   * @private
   */
  private handleError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (handlerError) {
        console.error(`Error in error handler for worker ${this.workerId}:`, handlerError);
      }
    }
  }

  /**
   * Terminate the worker
   *
   * Stops the worker thread and releases resources.
   * After termination, worker cannot be reused.
   */
  async terminate(): Promise<void> {
    if (this.terminated) {
      return;
    }

    this.terminated = true;

    try {
      if (this.worker && typeof this.worker.terminate === "function") {
        this.worker.terminate();
      }
    } catch (error) {
      console.warn(`Error terminating worker ${this.workerId}:`, error);
    }

    this.messageHandlers.clear();
    this.errorHandlers.clear();
    this.messageQueue.length = 0;
  }

  /**
   * Get worker last activity timestamp
   *
   * Used for idle timeout detection.
   *
   * @returns Timestamp in milliseconds
   */
  getLastActivityTime(): number {
    return this.lastActivityAt;
  }

  /**
   * Check if worker is still active
   *
   * @returns true if worker is ready and not terminated
   */
  isActive(): boolean {
    return this.ready && !this.terminated;
  }

  /**
   * Check if worker is terminated
   *
   * @returns true if worker has been terminated
   */
  isTerminated(): boolean {
    return this.terminated;
  }
}
