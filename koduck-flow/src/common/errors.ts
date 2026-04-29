/**
 * Flow unified error handling system
 *
 * Provides standardized error classification, error code definitions, and error handling mechanisms
 */
import { logger } from "./logger";

/**
 * Error category constants
 */
export const ErrorCategory = {
  /** Entity-related errors */
  ENTITY: "ENTITY",
  /** Registry-related errors */
  REGISTRY: "REGISTRY",
  /** Flow-related errors */
  FLOW: "FLOW",
  /** Rendering-related errors */
  RENDER: "RENDER",
  /** Event-related errors */
  EVENT: "EVENT",
  /** Validation-related errors */
  VALIDATION: "VALIDATION",
  /** Serialization-related errors */
  SERIALIZATION: "SERIALIZATION",
  /** Network-related errors */
  NETWORK: "NETWORK",
  /** System errors */
  SYSTEM: "SYSTEM",
  /** Configuration-related errors */
  CONFIG: "CONFIG",
} as const;

/**
 *
 */
export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/**
 * Error severity level constants
 */
export const ErrorSeverity = {
  /** Info level */
  INFO: "INFO",
  /** Warning level */
  WARNING: "WARNING",
  /** Error level */
  ERROR: "ERROR",
  /** Critical error level */
  CRITICAL: "CRITICAL",
  /** Fatal error level */
  FATAL: "FATAL",
} as const;

/**
 *
 */
export type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

/**
 * Error code constant definitions
 * Uses 6-digit integer segmented definition:
 * - 100000-101999: Entity-related errors (ENTITY)
 * - 102000-103999: Registry-related errors (REGISTRY)
 * - 104000-105999: Flow-related errors (FLOW)
 * - 106000-107999: Rendering-related errors (RENDER)
 * - 108000-109999: Event-related errors (EVENT)
 * - 110000-111999: Validation-related errors (VALIDATION)
 * - 112000-113999: Serialization-related errors (SERIALIZATION)
 * - 114000-115999: Network-related errors (NETWORK)
 * - 116000-117999: System errors (SYSTEM)
 * - 118000-119999: Configuration-related errors (CONFIG)
 * - 120000-199999: Reserved for 50 future error categories
 */
export const ErrorCode = {
  // Entity-related errors (100000-101999)
  ENTITY_NOT_FOUND: 100001,
  ENTITY_ALREADY_EXISTS: 100002,
  ENTITY_INVALID_TYPE: 100003,
  ENTITY_CREATION_FAILED: 100004,
  ENTITY_UPDATE_FAILED: 100005,
  ENTITY_DELETION_FAILED: 100006,
  ENTITY_INVALID_STATE: 100007,
  ENTITY_TYPE_NOT_REGISTERED: 100008,
  ENTITY_INVALID_ID: 100009,
  ENTITY_DISPOSE_FAILED: 100010,
  ENTITY_INVALID_ARGS: 100011,
  ENTITY_TYPE_MISMATCH: 100012,

  // Registry-related errors (102000-103999)
  REGISTRY_TYPE_NOT_FOUND: 102001,
  REGISTRY_TYPE_ALREADY_EXISTS: 102002,
  REGISTRY_INVALID_METADATA: 102003,
  REGISTRY_REGISTRATION_FAILED: 102004,
  REGISTRY_TYPE_ALREADY_REGISTERED: 102005,
  REGISTRY_INVALID_TYPE_INFO: 102006,
  REGISTRY_CONSTRUCTOR_INVALID: 102007,
  REGISTRY_DEFAULT_ARGS_INVALID: 102008,

  // Flow-related errors (104000-105999)
  FLOW_INVALID_CONFIGURATION: 104001,
  FLOW_EXECUTION_FAILED: 104002,
  FLOW_NODE_NOT_FOUND: 104003,
  FLOW_CONNECTION_INVALID: 104004,
  FLOW_CYCLE_DETECTED: 104005,

  // Rendering-related errors (106000-107999)
  RENDER_COMPONENT_NOT_FOUND: 106001,
  RENDER_INVALID_PROPS: 106002,
  RENDER_MOUNT_FAILED: 106003,

  // Event-related errors (108000-109999)
  EVENT_LISTENER_NOT_FOUND: 108001,
  EVENT_DISPATCH_FAILED: 108002,
  EVENT_INVALID_TYPE: 108003,
  EVENT_LISTENER_ERROR: 108004,

  // Validation-related errors (110000-111999)
  VALIDATION_REQUIRED_FIELD: 110001,
  VALIDATION_INVALID_TYPE: 110002,
  VALIDATION_OUT_OF_RANGE: 110003,
  VALIDATION_INVALID_FORMAT: 110004,

  // Serialization-related errors (112000-113999)
  SERIALIZATION_FAILED: 112001,
  DESERIALIZATION_FAILED: 112002,
  SERIALIZATION_INVALID_DATA: 112003,
  SERIALIZATION_UNSUPPORTED_TYPE: 112004,

  // Network-related errors (114000-115999)
  NETWORK_CONNECTION_FAILED: 114001,
  NETWORK_TIMEOUT: 114002,
  NETWORK_INVALID_RESPONSE: 114003,

  // System errors (116000-117999)
  SYSTEM_MEMORY_EXHAUSTED: 116001,
  SYSTEM_PERMISSION_DENIED: 116002,
  SYSTEM_RESOURCE_LOCKED: 116003,
  SYSTEM_UNEXPECTED_ERROR: 116004,

  // Configuration-related errors (118000-119999)
  CONFIG_INVALID_VALUE: 118001,
  CONFIG_MISSING_REQUIRED: 118002,
  CONFIG_PARSE_ERROR: 118003,
} as const;

/**
 * Union type of all defined error codes
 */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Error details interface
 */
export interface ErrorDetails {
  /** Error code */
  code: ErrorCode;
  /** Error category */
  category: ErrorCategory;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Error message */
  message: string;
  /** Context information */
  context?: Record<string, unknown> | undefined;
  /** Original error */
  cause?: Error | undefined;
  /** Timestamp */
  timestamp: number;
  /** Stack trace */
  stack?: string | undefined;
}

/**
 * Flow standard error class
 */
export class FlowError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context?: Record<string, unknown> | undefined;
  public readonly timestamp: number;

  /**
   * Creates a new FlowError instance
   * @param details Error details object (excluding auto-generated timestamp and stack fields)
   */
  constructor(details: Omit<ErrorDetails, "timestamp" | "stack">) {
    super(details.message);

    this.name = "FlowError";
    this.code = details.code;
    this.category = details.category;
    this.severity = details.severity;
    this.context = details.context;
    if (details.cause) {
      (this as unknown as { cause?: Error }).cause = details.cause;
    }
    this.timestamp = Date.now();
  }

  /**
   * Gets complete error details
   * @returns Error details containing all error fields
   */
  getDetails(): ErrorDetails {
    return {
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      context: this.context,
      cause: this.cause as Error | undefined,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Converts to JSON format
   * @returns Plain object containing all serializable error fields
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Formats error information for logging
   * @returns Formatted error string containing category, error code, severity, message, and optional context
   */
  format(): string {
    const contextStr = this.context ? ` | Context: ${JSON.stringify(this.context)}` : "";
    return `[${this.category}:${this.code}] ${this.severity}: ${this.message}${contextStr}`;
  }
}

/**
 * Error handler interface
 */
export type ErrorHandler = (error: FlowError) => void;

/**
 * Error manager
 */
export class ErrorManager {
  private static readonly handlers: Map<ErrorCategory, ErrorHandler[]> = new Map();
  private static readonly globalHandlers: ErrorHandler[] = [];

  /**
   * Registers an error handler
   * @param category Error category to listen for
   * @param handler Error handling callback function
   * @returns Unregister function; calling it removes the handler
   */
  static registerHandler(category: ErrorCategory, handler: ErrorHandler): () => void {
    if (!this.handlers.has(category)) {
      this.handlers.set(category, []);
    }
    this.handlers.get(category)!.push(handler);

    // Return unregister function
    return () => {
      const handlers = this.handlers.get(category);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Registers a global error handler
   * @param handler Error handling callback function effective for all error categories
   * @returns Unregister function; calling it removes the handler
   */
  static registerGlobalHandler(handler: ErrorHandler): () => void {
    this.globalHandlers.push(handler);

    // Return unregister function
    return () => {
      const index = this.globalHandlers.indexOf(handler);
      if (index > -1) {
        this.globalHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Handles an error
   * @param error FlowError instance to handle
   */
  static handleError(error: FlowError): void {
    // Execute category handlers
    const categoryHandlers = this.handlers.get(error.category) || [];
    categoryHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (handlerError) {
        logger.error("Error in error handler:", handlerError);
      }
    });

    // Execute global handlers
    this.globalHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (handlerError) {
        logger.error("Error in global error handler:", handlerError);
      }
    });

    // Default console output
    this.defaultConsoleHandler(error);
  }

  /**
   * Default console handler
   * @param error FlowError instance to output to console
   */
  private static defaultConsoleHandler(error: FlowError): void {
    const formattedMessage = error.format();

    // Advanced error handling (shared by CRITICAL and FATAL)
    const handleSevereError = () => {
      logger.error(formattedMessage);
      if (error.cause) {
        logger.error("Caused by:", error.cause as unknown);
      }
      if (error.stack) {
        logger.error("Stack trace:", error.stack as unknown);
      }
    };

    // Severity to handler function mapping table
    const severityHandlers = {
      [ErrorSeverity.INFO]: () => {},
      [ErrorSeverity.WARNING]: () => {},
      [ErrorSeverity.ERROR]: () => {
        logger.error(formattedMessage);
        if (error.cause) {
          logger.error("Caused by:", error.cause as unknown);
        }
      },
      [ErrorSeverity.CRITICAL]: handleSevereError,
      [ErrorSeverity.FATAL]: handleSevereError,
    };

    // Execute corresponding handler; if not found, default to error level handling
    const handler = severityHandlers[error.severity] || severityHandlers[ErrorSeverity.ERROR];
    handler();
  }

  /**
   * Clears all handlers
   */
  static clearAll(): void {
    this.handlers.clear();
    this.globalHandlers.length = 0;
  }
}

/**
 * Convenience function for creating errors
 * @param code Error code
 * @param message Error message
 * @param options Optional configuration
 * @param options.category Error category (auto-inferred from error code by default)
 * @param options.severity Error severity level (defaults to ERROR)
 * @param options.context Additional context information
 * @param options.cause Original error
 * @returns Constructed {@link FlowError} instance
 */
export function createError(
  code: ErrorCode,
  message: string,
  options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    context?: Record<string, unknown>;
    cause?: Error;
  } = {}
): FlowError {
  // Auto-infer category from error code
  const autoCategory = inferCategoryFromCode(code);

  return new FlowError({
    code,
    category: options.category || autoCategory,
    severity: options.severity || ErrorSeverity.ERROR,
    message,
    context: options.context,
    cause: options.cause,
  });
}

/**
 * Infers error category from error code
 * Uses 6-digit integer modulo segmentation to determine category, supports 50 error categories
 * @param code Error code to infer category for
 * @returns Corresponding {@link ErrorCategory}, returns SYSTEM for out-of-range codes
 */
function inferCategoryFromCode(code: ErrorCode): ErrorCategory {
  // Integers below 100000 are reserved
  if (code < 100000) {
    return ErrorCategory.SYSTEM;
  }

  // Segment to category mapping array (more efficient access)
  const segmentCategories: ErrorCategory[] = [
    ErrorCategory.ENTITY, // 0: 100000-101999
    ErrorCategory.REGISTRY, // 1: 102000-103999
    ErrorCategory.FLOW, // 2: 104000-105999
    ErrorCategory.RENDER, // 3: 106000-107999
    ErrorCategory.EVENT, // 4: 108000-109999
    ErrorCategory.VALIDATION, // 5: 110000-111999
    ErrorCategory.SERIALIZATION, // 6: 112000-113999
    ErrorCategory.NETWORK, // 7: 114000-115999
    ErrorCategory.SYSTEM, // 8: 116000-117999
    ErrorCategory.CONFIG, // 9: 118000-119999
  ];

  // Calculate the 2k segment (starting from 100000, every 2k is a segment, supports 50 categories)
  const segment = Math.floor((code - 100000) / 2000);

  // Return corresponding category; default to SYSTEM if out of range
  return segmentCategories[segment] ?? ErrorCategory.SYSTEM;
}
/**
 * Convenience function for throwing errors
 * @param code Error code
 * @param message Error message
 * @param options Optional configuration
 * @param options.category Error category (auto-inferred from error code by default)
 * @param options.severity Error severity level (defaults to ERROR)
 * @param options.context Additional context information
 * @param options.cause Original error
 * @returns never — always throws
 */
export function throwError(
  code: ErrorCode,
  message: string,
  options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    context?: Record<string, unknown>;
    cause?: Error;
  } = {}
): never {
  const error = createError(code, message, options);
  ErrorManager.handleError(error);
  throw error;
}

/**
 * Logs an error without throwing
 * @param code Error code
 * @param message Error message
 * @param options Optional configuration
 * @param options.category Error category (auto-inferred from error code by default)
 * @param options.severity Error severity level (defaults to ERROR)
 * @param options.context Additional context information
 * @param options.cause Original error
 * @returns Logged {@link FlowError} instance
 */
export const logError = (
  code: ErrorCode,
  message: string,
  options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    context?: Record<string, unknown>;
    cause?: Error;
  } = {}
): FlowError => {
  const error = createError(code, message, options);
  ErrorManager.handleError(error);
  return error;
};
