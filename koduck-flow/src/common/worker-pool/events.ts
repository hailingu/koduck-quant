/**
 * @file Worker Pool Event Definitions
 * @module worker-pool/events
 *
 * Defines all Worker Pool events that are emitted to the global event bus.
 * These events provide visibility into Worker Pool operations and state changes.
 *
 * **Event Categories**:
 * - Task lifecycle: submitted, completed, failed
 * - Worker lifecycle: created, terminated
 * - Pool management: scaling-up, scaling-down
 * - Health monitoring: health-warning
 *
 * @example
 * ```typescript
 * import { EventBus } from '@/common/event/event-bus';
 * import type { WorkerPoolTaskSubmittedEvent } from '@/common/worker-pool/events';
 *
 * const eventBus = new EventBus();
 *
 * // Subscribe to task submitted events
 * eventBus.on<WorkerPoolTaskSubmittedEvent>('worker-pool:task-submitted', (event) => {
 *   console.log(`Task ${event.taskId} submitted with priority ${event.priority}`);
 * });
 * ```
 */

/**
 * Worker Pool Task Submitted Event
 * Fired when a new task is submitted to the worker pool
 */
export interface WorkerPoolTaskSubmittedEvent {
  /** Event type identifier */
  type: "worker-pool:task-submitted";
  /** Unique task identifier */
  taskId: string;
  /** Task type/category */
  taskType: string;
  /** Task priority (0-10) */
  priority: number;
  /** Task timeout in milliseconds */
  timeout?: number;
  /** Current queue size after submission */
  queueSize: number;
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Worker Pool Task Completed Event
 * Fired when a task completes successfully
 */
export interface WorkerPoolTaskCompletedEvent {
  /** Event type identifier */
  type: "worker-pool:task-completed";
  /** Unique task identifier */
  taskId: string;
  /** Task type/category */
  taskType: string;
  /** Worker ID that executed the task */
  workerId: string;
  /** Task execution duration in milliseconds */
  duration: number;
  /** Result data (may be truncated for large payloads) */
  result?: unknown;
  /** Number of retries needed */
  retryCount: number;
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Worker Pool Task Failed Event
 * Fired when a task fails after all retry attempts
 */
export interface WorkerPoolTaskFailedEvent {
  /** Event type identifier */
  type: "worker-pool:task-failed";
  /** Unique task identifier */
  taskId: string;
  /** Task type/category */
  taskType: string;
  /** Worker ID that last attempted execution */
  workerId?: string;
  /** Error message */
  error: string;
  /** Error code (if available) */
  errorCode?: string;
  /** Number of retry attempts made */
  retryCount: number;
  /** Final task duration in milliseconds */
  duration: number;
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Worker Pool Worker Created Event
 * Fired when a new worker is created and initialized
 */
export interface WorkerPoolWorkerCreatedEvent {
  /** Event type identifier */
  type: "worker-pool:worker-created";
  /** Worker ID */
  workerId: string;
  /** Total active workers after creation */
  totalWorkers: number;
  /** Current idle worker count */
  idleWorkers: number;
  /** Worker creation duration in milliseconds */
  creationDuration: number;
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Worker Pool Worker Terminated Event
 * Fired when a worker is terminated and removed from the pool
 */
export interface WorkerPoolWorkerTerminatedEvent {
  /** Event type identifier */
  type: "worker-pool:worker-terminated";
  /** Worker ID */
  workerId: string;
  /** Reason for termination */
  reason: "idle-timeout" | "error-recovery" | "manual" | "pool-shutdown";
  /** Tasks completed by this worker */
  tasksCompleted: number;
  /** Tasks failed by this worker */
  tasksFailed: number;
  /** Total active workers after termination */
  totalWorkers: number;
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Worker Pool Scaling Up Event
 * Fired when the pool automatically creates new workers to handle load
 */
export interface WorkerPoolScalingUpEvent {
  /** Event type identifier */
  type: "worker-pool:scaling-up";
  /** Number of new workers created */
  newWorkerCount: number;
  /** Total workers before scaling */
  previousWorkerCount: number;
  /** Total workers after scaling */
  totalWorkers: number;
  /** Queue length that triggered scaling */
  queueLength: number;
  /** Queue usage percentage (0-100) */
  queueUsagePercent: number;
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Worker Pool Scaling Down Event
 * Fired when the pool removes idle workers to free resources
 */
export interface WorkerPoolScalingDownEvent {
  /** Event type identifier */
  type: "worker-pool:scaling-down";
  /** Number of workers removed */
  removedWorkerCount: number;
  /** Total workers before scaling */
  previousWorkerCount: number;
  /** Total workers after scaling */
  totalWorkers: number;
  /** Reason for scaling down */
  reason: "idle-workers" | "resource-recovery" | "manual";
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Worker Pool Health Warning Event
 * Fired when pool health metrics indicate potential issues
 */
export interface WorkerPoolHealthWarningEvent {
  /** Event type identifier */
  type: "worker-pool:health-warning";
  /** Warning type */
  warningType:
    | "high-failure-rate"
    | "high-queue-length"
    | "memory-pressure"
    | "worker-timeout"
    | "slow-response-time";
  /** Severity level (1-5, 5 being highest) */
  severity: 1 | 2 | 3 | 4 | 5;
  /** Human-readable warning message */
  message: string;
  /** Current pool statistics */
  stats?: {
    totalWorkers?: number;
    idleWorkers?: number;
    busyWorkers?: number;
    queuedTasks?: number;
    failureRate?: number;
    avgResponseTime?: number;
  };
  /** Recommended action */
  recommendedAction?: string;
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Union type of all Worker Pool events
 */
export type WorkerPoolEvent =
  | WorkerPoolTaskSubmittedEvent
  | WorkerPoolTaskCompletedEvent
  | WorkerPoolTaskFailedEvent
  | WorkerPoolWorkerCreatedEvent
  | WorkerPoolWorkerTerminatedEvent
  | WorkerPoolScalingUpEvent
  | WorkerPoolScalingDownEvent
  | WorkerPoolHealthWarningEvent;

/**
 * Worker Pool event names
 */
export const WORKER_POOL_EVENTS = {
  TASK_SUBMITTED: "worker-pool:task-submitted" as const,
  TASK_COMPLETED: "worker-pool:task-completed" as const,
  TASK_FAILED: "worker-pool:task-failed" as const,
  WORKER_CREATED: "worker-pool:worker-created" as const,
  WORKER_TERMINATED: "worker-pool:worker-terminated" as const,
  SCALING_UP: "worker-pool:scaling-up" as const,
  SCALING_DOWN: "worker-pool:scaling-down" as const,
  HEALTH_WARNING: "worker-pool:health-warning" as const,
} as const;

/**
 * Type guard for Worker Pool events
 * @param event - Event object with type property to check
 * @param event.type - The event type string to validate
 * @returns True if event is a Worker Pool event
 */
export function isWorkerPoolEvent(event: { type: string }): event is WorkerPoolEvent {
  return (
    event.type === WORKER_POOL_EVENTS.TASK_SUBMITTED ||
    event.type === WORKER_POOL_EVENTS.TASK_COMPLETED ||
    event.type === WORKER_POOL_EVENTS.TASK_FAILED ||
    event.type === WORKER_POOL_EVENTS.WORKER_CREATED ||
    event.type === WORKER_POOL_EVENTS.WORKER_TERMINATED ||
    event.type === WORKER_POOL_EVENTS.SCALING_UP ||
    event.type === WORKER_POOL_EVENTS.SCALING_DOWN ||
    event.type === WORKER_POOL_EVENTS.HEALTH_WARNING
  );
}
