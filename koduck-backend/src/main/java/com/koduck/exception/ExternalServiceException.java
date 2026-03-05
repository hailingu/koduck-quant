package com.koduck.exception;

import lombok.Getter;

/**
 * 外部服务异常。
 *
 * <p>用于表示调用外部服务（如数据服务、AI 服务等）失败的情况。</p>
 *
 * @author Koduck Team
 */
@Getter
public class ExternalServiceException extends BusinessException {

    /**
     * 服务名称
     */
    private final String serviceName;

    /**
     * 创建外部服务异常。
     *
     * @param message 错误消息
     */
    public ExternalServiceException(String message) {
        super(ErrorCode.EXTERNAL_SERVICE_ERROR.getCode(), message);
        this.serviceName = null;
    }

    /**
     * 创建外部服务异常。
     *
     * @param errorCode 错误码枚举
     */
    public ExternalServiceException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.serviceName = null;
    }

    /**
     * 创建外部服务异常。
     *
     * @param serviceName 服务名称
     * @param message     错误消息
     */
    public ExternalServiceException(String serviceName, String message) {
        super(ErrorCode.EXTERNAL_SERVICE_ERROR.getCode(),
                String.format("[%s] %s", serviceName, message));
        this.serviceName = serviceName;
    }

    /**
     * 创建外部服务异常。
     *
     * @param serviceName 服务名称
     * @param message     错误消息
     * @param cause       原始异常
     */
    public ExternalServiceException(String serviceName, String message, Throwable cause) {
        super(ErrorCode.EXTERNAL_SERVICE_ERROR.getCode(),
                String.format("[%s] %s", serviceName, message), cause);
        this.serviceName = serviceName;
    }

    /**
     * 快速创建外部服务异常。
     *
     * @param serviceName 服务名称
     * @param message     错误消息
     * @return ExternalServiceException
     */
    public static ExternalServiceException of(String serviceName, String message) {
        return new ExternalServiceException(serviceName, message);
    }

    /**
     * 快速创建外部服务异常。
     *
     * @param serviceName 服务名称
     * @param message     错误消息
     * @param cause       原始异常
     * @return ExternalServiceException
     */
    public static ExternalServiceException of(String serviceName, String message, Throwable cause) {
        return new ExternalServiceException(serviceName, message, cause);
    }
}
