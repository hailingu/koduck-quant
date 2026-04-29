/**
 * Default Worker Script
 *
 * This is the default Worker implementation for the Worker Pool.
 * It handles message processing, error reporting, and task execution.
 *
 * ## Message Types
 *
 * - **task**: Execute a task with provided data
 * - **ping**: Health check / heartbeat message
 * - **terminate**: Graceful shutdown signal
 *
 * ## Features
 *
 * - Async task execution support
 * - Comprehensive error handling and reporting
 * - Progress reporting (optional)
 * - Internal logging system
 * - Cross-platform compatibility (browser and Node.js)
 */

/**
 * Message received from main thread
 */
interface WorkerMessage {
  type: "task" | "ping" | "terminate";
  taskId?: string;
  taskType?: string;
  data?: unknown;
  timestamp: number;
}

/**
 * Response sent back to main thread
 */
interface WorkerResponse {
  type: "result" | "error" | "progress" | "pong";
  taskId?: string;
  taskType?: string;
  data?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  progress?: number;
  duration?: number;
  timestamp: number;
}

/**
 * Task execution context within worker
 */
interface TaskContext {
  taskId: string;
  taskType: string;
  data: unknown;
  startTime: number;
}

/**
 * Worker logger for internal diagnostics
 */
class WorkerLogger {
  private readonly prefix = "[Worker]";

  debug(message: string, data?: unknown): void {
    if (typeof console !== "undefined" && console.debug) {
      console.debug(`${this.prefix} [DEBUG]`, message, data);
    }
  }

  info(message: string, data?: unknown): void {
    if (typeof console !== "undefined" && console.info) {
      console.info(`${this.prefix} [INFO]`, message, data);
    }
  }

  warn(message: string, data?: unknown): void {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(`${this.prefix} [WARN]`, message, data);
    }
  }

  error(message: string, data?: unknown): void {
    if (typeof console !== "undefined" && console.error) {
      console.error(`${this.prefix} [ERROR]`, message, data);
    }
  }
}

/**
 * Default task executor - can be overridden for custom task types
 */
class TaskExecutor {
  private readonly logger = new WorkerLogger();

  /**
   * Execute a task based on its type
   * @param context - The task execution context
   * @returns Promise resolving to task result
   */
  async execute(context: TaskContext): Promise<unknown> {
    const { taskType, data } = context;

    // Log task start
    this.logger.info(`Executing task ${taskType}`, { taskId: context.taskId });

    // Route to appropriate handler based on task type
    switch (taskType) {
      case "echo":
        return this.executeEcho(data);

      case "delay":
        return this.executeDelay(data);

      case "compute":
        return this.executeCompute(data);

      case "error-test":
        return this.executeErrorTest(data);

      default:
        return this.executeDefault(data);
    }
  }

  /**
   * Echo task - returns input data
   * @param data - Input data to echo
   * @returns Promise resolving to echoed data
   */
  private executeEcho(data: unknown): Promise<unknown> {
    return Promise.resolve({ echo: data, timestamp: Date.now() });
  }

  /**
   * Delay task - resolves after specified milliseconds
   * @param data - Object with ms property for delay duration
   * @returns Promise resolving after delay
   */
  private async executeDelay(data: unknown): Promise<unknown> {
    const { ms = 1000 } = (data as Record<string, unknown>) || {};
    const delay = Math.min(Math.max(0, Number(ms) || 0), 60000); // Cap at 60s
    await new Promise((resolve) => setTimeout(resolve, delay));
    return { delayed: delay, timestamp: Date.now() };
  }

  /**
   * Compute task - performs simple computation
   * @param data - Object with values array for computation
   * @returns Promise resolving to computation results
   */
  private executeCompute(data: unknown): Promise<unknown> {
    const { values = [] } = (data as Record<string, unknown>) || {};
    const arr = Array.isArray(values) ? values : [];
    const sum = arr.reduce((acc, v) => acc + (Number(v) || 0), 0);
    const avg = arr.length > 0 ? sum / arr.length : 0;
    return Promise.resolve({ sum, avg, count: arr.length });
  }

  /**
   * Error test task - deliberately throws an error
   * @param data - Object with error message
   * @returns Promise rejecting with error
   */
  private executeErrorTest(data: unknown): Promise<unknown> {
    const { message = "Test error" } = (data as Record<string, unknown>) || {};
    return Promise.reject(new Error(String(message)));
  }

  /**
   * Default task - simple passthrough
   * @param data - Data to pass through
   * @returns Promise resolving to input data
   */
  private executeDefault(data: unknown): Promise<unknown> {
    return Promise.resolve({ result: data, timestamp: Date.now() });
  }
}

/**
 * Main Worker Handler
 */
class WorkerHandler {
  private readonly logger = new WorkerLogger();
  private readonly executor = new TaskExecutor();
  private currentTask: TaskContext | null = null;
  private isTerminating = false;

  constructor() {
    this.setupMessageHandler();
    this.logger.info("Worker initialized");
  }

  /**
   * Setup message event listener
   */
  private setupMessageHandler(): void {
    // Use globalThis for cross-platform compatibility
    if (typeof globalThis !== "undefined" && typeof globalThis.addEventListener === "function") {
      // Security: Message origin is verified by the worker pool manager (WorkerWrapper)
      // The worker pool controller handles origin verification at the application level
      // and only posts messages from trusted sources
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globalThis.addEventListener("message", (event: MessageEvent<any>) => {
        const data = event.data;
        if (data && typeof data === "object") {
          this.handleMessage(data);
        }
      });
    }
  }

  /**
   * Main message handler
   * @param message - The message data from main thread
   */
  private async handleMessage(message: unknown): Promise<void> {
    try {
      const msg = message as WorkerMessage;
      this.logger.debug("Message received", { type: msg.type, taskId: msg.taskId });

      if (!msg.type) {
        this.logger.warn("Invalid message: missing type");
        return;
      }

      switch (msg.type) {
        case "task":
          await this.handleTask(msg);
          break;

        case "ping":
          this.handlePing();
          break;

        case "terminate":
          this.handleTerminate();
          break;

        default:
          this.logger.warn(`Unknown message type: ${msg.type}`);
      }
    } catch (error) {
      this.logger.error("Error handling message", error);
      this.sendError("unknown", "generic", error);
    }
  }

  /**
   * Handle task execution message
   * @param msg - The task message
   */
  private async handleTask(msg: WorkerMessage): Promise<void> {
    if (!msg.taskId || !msg.taskType) {
      this.logger.warn("Invalid task message: missing taskId or taskType");
      return;
    }

    if (this.currentTask) {
      this.logger.warn(`Task already running: ${this.currentTask.taskId}`);
      return;
    }

    const taskId = msg.taskId;
    const startTime = Date.now();

    try {
      // Create task context
      const context: TaskContext = {
        taskId,
        taskType: msg.taskType,
        data: msg.data,
        startTime,
      };

      this.currentTask = context;
      this.logger.info(`Task started: ${taskId}`, { taskType: msg.taskType });

      // Execute task
      const result = await this.executor.execute(context);

      // Send result
      const duration = Date.now() - startTime;
      this.sendResult(taskId, msg.taskType, result, duration);
      this.logger.info(`Task completed: ${taskId}`, { duration });
    } catch (error) {
      this.logger.error(`Task failed: ${taskId}`, error);
      this.sendError(taskId, msg.taskType, error);
    } finally {
      this.currentTask = null;
    }
  }

  /**
   * Handle ping/heartbeat message
   */
  private handlePing(): void {
    this.logger.debug("Ping received");

    const response: WorkerResponse = {
      type: "pong",
      timestamp: Date.now(),
    };

    this.postMessage(response);
    this.logger.debug("Pong sent");
  }

  /**
   * Handle terminate message
   */
  private handleTerminate(): void {
    this.logger.info("Terminate signal received");

    if (this.currentTask) {
      this.logger.warn(`Terminating while task running: ${this.currentTask.taskId}`);
    }

    this.isTerminating = true;
    this.logger.info("Worker terminating");

    // Give a moment for any pending responses
    setTimeout(() => {
      if (typeof close === "function") {
        close();
      }
    }, 100);
  }

  /**
   * Send task result to main thread
   * @param taskId - The task identifier
   * @param taskType - The task type
   * @param data - The result data
   * @param duration - The execution duration in milliseconds
   */
  private sendResult(taskId: string, taskType: string, data: unknown, duration: number): void {
    const response: WorkerResponse = {
      type: "result",
      taskId,
      taskType,
      data,
      duration,
      timestamp: Date.now(),
    };

    this.postMessage(response);
  }

  /**
   * Send error to main thread
   * @param taskId - The task identifier
   * @param taskType - The task type
   * @param error - The error object
   */
  private sendError(taskId: string, taskType: string, error: unknown): void {
    let errorObj: { name: string; message: string; stack?: string } | undefined;

    if (error instanceof Error) {
      errorObj = {
        name: error.name,
        message: error.message,
      };
      if (error.stack) {
        errorObj.stack = error.stack;
      }
    } else {
      errorObj = {
        name: "UnknownError",
        message: String(error),
      };
    }

    const response: WorkerResponse = {
      type: "error",
      taskId,
      taskType,
      error: errorObj,
      timestamp: Date.now(),
    };

    this.postMessage(response);
  }

  /**
   * Post message to main thread
   * @param message - The response message
   */
  private postMessage(message: WorkerResponse): void {
    // Use globalThis.postMessage for cross-platform compatibility
    if (typeof globalThis !== "undefined" && typeof globalThis.postMessage === "function") {
      globalThis.postMessage(message);
    }
  }
}

// Initialize worker when script loads
if (typeof globalThis !== "undefined" && typeof globalThis.addEventListener === "function") {
  const _handler = new WorkerHandler();
}
