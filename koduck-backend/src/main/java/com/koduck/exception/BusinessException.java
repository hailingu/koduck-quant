package com.koduck.exception;

import lombok.Getter;

/**
 * 业务异常。
 *
 * <p>用于表示业务逻辑层面的错误，如参数校验失败、资源不存在等。</p>
 *
 * @author Koduck Team
 */
@Getter
public class BusinessException extends RuntimeException {

    /**
     * 错误码
     */
    private final int code;

    /**
     * 创建业务异常。
     *
     * @param code    错误码
     * @param message 错误消息
     */
    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * 创建业务异常（默认错误码）。
     *
     * @param message 错误消息
     */
    public BusinessException(String message) {
        this(ErrorCode.BUSINESS_ERROR.getCode(), message);
    }

    /**
     * 创建业务异常。
     *
     * @param errorCode 错误码枚举
     */
    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.code = errorCode.getCode();
    }

    /**
     * 创建业务异常。
     *
     * @param errorCode 错误码枚举
     * @param message   自定义错误消息
     */
    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
    }

    /**
     * 创建业务异常。
     *
     * @param code    错误码
     * @param message 错误消息
     * @param cause   原始异常
     */
    public BusinessException(int code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    /**
     * 创建业务异常。
     *
     * @param errorCode 错误码枚举
     * @param cause     原始异常
     */
    public BusinessException(ErrorCode errorCode, Throwable cause) {
        super(errorCode.getDefaultMessage(), cause);
        this.code = errorCode.getCode();
    }

    /**
     * 获取对应的 HTTP 状态码。
     *
     * @return HTTP 状态码
     */
    public int getHttpStatus() {
        ErrorCode errorCode = ErrorCode.fromCode(code);
        return errorCode.getHttpStatus().value();
    }
}
