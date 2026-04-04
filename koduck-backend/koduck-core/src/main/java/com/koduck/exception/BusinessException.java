package com.koduck.exception;

import java.io.Serial;

import lombok.Getter;

/**
 * Base class for domain/business exceptions.
 *
 * <p>It carries a stable business error code used by API responses and
 * monitoring pipelines.</p>
 *
 * @author Koduck Team
 */
@Getter
public class BusinessException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * Business error code defined by {@link ErrorCode}.
     */
    private final int code;

    /**
     * Creates an exception with explicit business code and message.
     *
     * @param code business error code
     * @param message error message
     */
    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Creates an exception with default {@link ErrorCode#BUSINESS_ERROR} code.
     *
     * @param message error message
     */
    public BusinessException(String message) {
        this(ErrorCode.BUSINESS_ERROR.getCode(), message);
    }

    /**
     * Creates an exception from a predefined {@link ErrorCode}.
     *
     * @param errorCode predefined business error code
     */
    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.code = errorCode.getCode();
    }

    /**
     * Creates an exception from a predefined {@link ErrorCode} with custom message.
     *
     * @param errorCode predefined business error code
     * @param message custom error message
     */
    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
    }

    /**
     * Creates an exception with explicit code, message and root cause.
     *
     * @param code business error code
     * @param message error message
     * @param cause root cause
     */
    public BusinessException(int code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    /**
     * Creates an exception from {@link ErrorCode} and root cause.
     *
     * @param errorCode predefined business error code
     * @param cause root cause
     */
    public BusinessException(ErrorCode errorCode, Throwable cause) {
        super(errorCode.getDefaultMessage(), cause);
        this.code = errorCode.getCode();
    }

    /**
     * Resolves mapped HTTP status code from current business code.
     *
     * @return HTTP status code value
     */
    public int getHttpStatus() {
        ErrorCode errorCode = ErrorCode.fromCode(code);
        return errorCode.getHttpStatus().value();
    }
}
