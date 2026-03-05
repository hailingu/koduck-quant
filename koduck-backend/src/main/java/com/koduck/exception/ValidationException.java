package com.koduck.exception;

import lombok.Getter;

import java.util.Collections;
import java.util.Map;

/**
 * 参数校验异常。
 *
 * <p>用于表示请求参数校验失败的情况，可以携带具体的字段错误信息。</p>
 *
 * @author Koduck Team
 */
@Getter
public class ValidationException extends BusinessException {

    /**
     * 字段错误映射，key 为字段名，value 为错误消息
     */
    private final Map<String, String> fieldErrors;

    /**
     * 创建校验异常。
     *
     * @param message 错误消息
     */
    public ValidationException(String message) {
        super(ErrorCode.VALIDATION_ERROR.getCode(), message);
        this.fieldErrors = Collections.emptyMap();
    }

    /**
     * 创建校验异常。
     *
     * @param errorCode 错误码枚举
     */
    public ValidationException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.fieldErrors = Collections.emptyMap();
    }

    /**
     * 创建校验异常（带字段错误）。
     *
     * @param message     错误消息
     * @param fieldErrors 字段错误映射
     */
    public ValidationException(String message, Map<String, String> fieldErrors) {
        super(ErrorCode.VALIDATION_ERROR.getCode(), message);
        this.fieldErrors = fieldErrors != null ? Map.copyOf(fieldErrors) : Collections.emptyMap();
    }

    /**
     * 创建校验异常（带单个字段错误）。
     *
     * @param field   字段名
     * @param message 错误消息
     * @return ValidationException
     */
    public static ValidationException forField(String field, String message) {
        return new ValidationException(message, Map.of(field, message));
    }
}
