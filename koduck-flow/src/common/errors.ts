/**
 * Flow 统一错误处理系统
 *
 * 提供标准化的错误分类、错误码定义和错误处理机制
 */
import { logger } from "./logger";

/**
 * 错误类别常量
 */
export const ErrorCategory = {
  /** 实体相关错误 */
  ENTITY: "ENTITY",
  /** 注册表相关错误 */
  REGISTRY: "REGISTRY",
  /** 流程相关错误 */
  FLOW: "FLOW",
  /** 渲染相关错误 */
  RENDER: "RENDER",
  /** 事件相关错误 */
  EVENT: "EVENT",
  /** 验证相关错误 */
  VALIDATION: "VALIDATION",
  /** 序列化相关错误 */
  SERIALIZATION: "SERIALIZATION",
  /** 网络相关错误 */
  NETWORK: "NETWORK",
  /** 系统错误 */
  SYSTEM: "SYSTEM",
  /** 配置相关错误 */
  CONFIG: "CONFIG",
} as const;

/**
 *
 */
export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/**
 * 错误严重级别常量
 */
export const ErrorSeverity = {
  /** 信息级别 */
  INFO: "INFO",
  /** 警告级别 */
  WARNING: "WARNING",
  /** 错误级别 */
  ERROR: "ERROR",
  /** 严重错误级别 */
  CRITICAL: "CRITICAL",
  /** 致命错误级别 */
  FATAL: "FATAL",
} as const;

/**
 *
 */
export type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

/**
 * 错误码常量定义
 * 使用6位整数分段定义方式:
 * - 100000-101999: 实体相关错误 (ENTITY)
 * - 102000-103999: 注册表相关错误 (REGISTRY)
 * - 104000-105999: 流程相关错误 (FLOW)
 * - 106000-107999: 渲染相关错误 (RENDER)
 * - 108000-109999: 事件相关错误 (EVENT)
 * - 110000-111999: 验证相关错误 (VALIDATION)
 * - 112000-113999: 序列化相关错误 (SERIALIZATION)
 * - 114000-115999: 网络相关错误 (NETWORK)
 * - 116000-117999: 系统错误 (SYSTEM)
 * - 118000-119999: 配置相关错误 (CONFIG)
 * - 120000-199999: 预留给未来50类错误分类使用
 */
export const ErrorCode = {
  // 实体相关错误 (100000-101999)
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

  // 注册表相关错误 (102000-103999)
  REGISTRY_TYPE_NOT_FOUND: 102001,
  REGISTRY_TYPE_ALREADY_EXISTS: 102002,
  REGISTRY_INVALID_METADATA: 102003,
  REGISTRY_REGISTRATION_FAILED: 102004,
  REGISTRY_TYPE_ALREADY_REGISTERED: 102005,
  REGISTRY_INVALID_TYPE_INFO: 102006,
  REGISTRY_CONSTRUCTOR_INVALID: 102007,
  REGISTRY_DEFAULT_ARGS_INVALID: 102008,

  // 流程相关错误 (104000-105999)
  FLOW_INVALID_CONFIGURATION: 104001,
  FLOW_EXECUTION_FAILED: 104002,
  FLOW_NODE_NOT_FOUND: 104003,
  FLOW_CONNECTION_INVALID: 104004,
  FLOW_CYCLE_DETECTED: 104005,

  // 渲染相关错误 (106000-107999)
  RENDER_COMPONENT_NOT_FOUND: 106001,
  RENDER_INVALID_PROPS: 106002,
  RENDER_MOUNT_FAILED: 106003,

  // 事件相关错误 (108000-109999)
  EVENT_LISTENER_NOT_FOUND: 108001,
  EVENT_DISPATCH_FAILED: 108002,
  EVENT_INVALID_TYPE: 108003,
  EVENT_LISTENER_ERROR: 108004,

  // 验证相关错误 (110000-111999)
  VALIDATION_REQUIRED_FIELD: 110001,
  VALIDATION_INVALID_TYPE: 110002,
  VALIDATION_OUT_OF_RANGE: 110003,
  VALIDATION_INVALID_FORMAT: 110004,

  // 序列化相关错误 (112000-113999)
  SERIALIZATION_FAILED: 112001,
  DESERIALIZATION_FAILED: 112002,
  SERIALIZATION_INVALID_DATA: 112003,
  SERIALIZATION_UNSUPPORTED_TYPE: 112004,

  // 网络相关错误 (114000-115999)
  NETWORK_CONNECTION_FAILED: 114001,
  NETWORK_TIMEOUT: 114002,
  NETWORK_INVALID_RESPONSE: 114003,

  // 系统错误 (116000-117999)
  SYSTEM_MEMORY_EXHAUSTED: 116001,
  SYSTEM_PERMISSION_DENIED: 116002,
  SYSTEM_RESOURCE_LOCKED: 116003,
  SYSTEM_UNEXPECTED_ERROR: 116004,

  // 配置相关错误 (118000-119999)
  CONFIG_INVALID_VALUE: 118001,
  CONFIG_MISSING_REQUIRED: 118002,
  CONFIG_PARSE_ERROR: 118003,
} as const;

/**
 * 所有已定义错误码的联合类型
 */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * 错误详情接口
 */
export interface ErrorDetails {
  /** 错误码 */
  code: ErrorCode;
  /** 错误类别 */
  category: ErrorCategory;
  /** 错误严重级别 */
  severity: ErrorSeverity;
  /** 错误消息 */
  message: string;
  /** 上下文信息 */
  context?: Record<string, unknown> | undefined;
  /** 原始错误 */
  cause?: Error | undefined;
  /** 时间戳 */
  timestamp: number;
  /** 堆栈跟踪 */
  stack?: string | undefined;
}

/**
 * Flow 标准错误类
 */
export class FlowError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context?: Record<string, unknown> | undefined;
  public readonly timestamp: number;

  /**
   * 创建一个新的 FlowError 实例
   * @param details 错误详情对象（不含自动生成的 timestamp 和 stack 字段）
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
   * 获取完整的错误详情
   * @returns 包含所有错误字段的 {@link ErrorDetails} 对象
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
   * 转换为JSON格式
   * @returns 包含错误所有可序列化字段的普通对象
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
   * 格式化错误信息用于日志
   * @returns 格式化后的错误字符串，包含类别、错误码、严重级别、消息及可选上下文
   */
  format(): string {
    const contextStr = this.context ? ` | Context: ${JSON.stringify(this.context)}` : "";
    return `[${this.category}:${this.code}] ${this.severity}: ${this.message}${contextStr}`;
  }
}

/**
 * 错误处理器接口
 */
export type ErrorHandler = (error: FlowError) => void;

/**
 * 错误管理器
 */
export class ErrorManager {
  private static readonly handlers: Map<ErrorCategory, ErrorHandler[]> = new Map();
  private static readonly globalHandlers: ErrorHandler[] = [];

  /**
   * 注册错误处理器
   * @param category 要监听的错误类别
   * @param handler 错误处理回调函数
   * @returns 取消注册的函数，调用后移除该处理器
   */
  static registerHandler(category: ErrorCategory, handler: ErrorHandler): () => void {
    if (!this.handlers.has(category)) {
      this.handlers.set(category, []);
    }
    this.handlers.get(category)!.push(handler);

    // 返回取消注册函数
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
   * 注册全局错误处理器
   * @param handler 错误处理回调函数，对所有类别的错误均生效
   * @returns 取消注册的函数，调用后移除该处理器
   */
  static registerGlobalHandler(handler: ErrorHandler): () => void {
    this.globalHandlers.push(handler);

    // 返回取消注册函数
    return () => {
      const index = this.globalHandlers.indexOf(handler);
      if (index > -1) {
        this.globalHandlers.splice(index, 1);
      }
    };
  }

  /**
   * 处理错误
   * @param error 要处理的 FlowError 实例
   */
  static handleError(error: FlowError): void {
    // 执行分类处理器
    const categoryHandlers = this.handlers.get(error.category) || [];
    categoryHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (handlerError) {
        logger.error("Error in error handler:", handlerError);
      }
    });

    // 执行全局处理器
    this.globalHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (handlerError) {
        logger.error("Error in global error handler:", handlerError);
      }
    });

    // 默认控制台输出
    this.defaultConsoleHandler(error);
  }

  /**
   * 默认控制台处理器
   * @param error 要输出到控制台的 FlowError 实例
   */
  private static defaultConsoleHandler(error: FlowError): void {
    const formattedMessage = error.format();

    // 高级错误处理（CRITICAL 和 FATAL 共用）
    const handleSevereError = () => {
      logger.error(formattedMessage);
      if (error.cause) {
        logger.error("Caused by:", error.cause as unknown);
      }
      if (error.stack) {
        logger.error("Stack trace:", error.stack as unknown);
      }
    };

    // 严重级别到处理函数的映射表
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

    // 执行对应的处理函数，如果没有找到则默认使用 error 级别处理
    const handler = severityHandlers[error.severity] || severityHandlers[ErrorSeverity.ERROR];
    handler();
  }

  /**
   * 清理所有处理器
   */
  static clearAll(): void {
    this.handlers.clear();
    this.globalHandlers.length = 0;
  }
}

/**
 * 创建错误的便捷函数
 * @param code 错误码
 * @param message 错误消息
 * @param options 可选配置
 * @param options.category 错误类别（默认根据错误码自动推断）
 * @param options.severity 错误严重级别（默认为 ERROR）
 * @param options.context 附加上下文信息
 * @param options.cause 原始错误
 * @returns 构造好的 {@link FlowError} 实例
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
  // 根据错误码自动推断类别
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
 * 根据错误码推断错误类别
 * 使用6位整数取模分段方式判断类别，支持50类错误分类
 * @param code 要推断类别的错误码
 * @returns 对应的 {@link ErrorCategory}，未知范围的码值返回 SYSTEM
 */
function inferCategoryFromCode(code: ErrorCode): ErrorCategory {
  // 10万以下的整数作为保留
  if (code < 100000) {
    return ErrorCategory.SYSTEM;
  }

  // 分段到类别的映射数组（更高效的访问）
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

  // 计算所在的2千段 (从10万开始，每2千个为一段，支持50类)
  const segment = Math.floor((code - 100000) / 2000);

  // 返回对应类别，如果超出范围则默认为 SYSTEM
  return segmentCategories[segment] ?? ErrorCategory.SYSTEM;
}
/**
 * 抛出错误的便捷函数
 * @param code 错误码
 * @param message 错误消息
 * @param options 可选配置
 * @param options.category 错误类别（默认根据错误码自动推断）
 * @param options.severity 错误严重级别（默认为 ERROR）
 * @param options.context 附加上下文信息
 * @param options.cause 原始错误
 * @returns never — 始终抛出异常
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
 * 记录错误但不抛出
 * @param code 错误码
 * @param message 错误消息
 * @param options 可选配置
 * @param options.category 错误类别（默认根据错误码自动推断）
 * @param options.severity 错误严重级别（默认为 ERROR）
 * @param options.context 附加上下文信息
 * @param options.cause 原始错误
 * @returns 已记录的 {@link FlowError} 实例
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
