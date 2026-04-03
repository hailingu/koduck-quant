package com.koduck.exception;

import java.io.Serial;

import lombok.Getter;

/**
 * Exception for duplicate resource or unique-constraint conflicts.
 *
 * <p>Typically used when creating/updating data violates uniqueness rules.</p>
 *
 * @author Koduck Team
 */
@Getter
public class DuplicateException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * Name of the duplicate field.
     */
    private final String field;

    /**
     * Duplicate field value.
     */
    private final transient Object value;

    /**
     * Creates an exception with custom message.
     *
     * @param message error message
     */
    public DuplicateException(String message) {
        super(ErrorCode.DUPLICATE_ERROR.getCode(), message);
        this.field = null;
        this.value = null;
    }

    /**
     * Creates an exception from predefined error code.
     *
     * @param errorCode duplicate-related error code
     */
    public DuplicateException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.field = null;
        this.value = null;
    }

    /**
     * Creates an exception from duplicate field/value and custom message.
     *
     * @param field duplicate field name
     * @param value duplicate value
     * @param message custom error message
     */
    public DuplicateException(String field, Object value, String message) {
        super(ErrorCode.DUPLICATE_ERROR.getCode(), message);
        this.field = field;
        this.value = value;
    }

    /**
     * Creates an exception from duplicate field/value with default message.
     *
     * @param field duplicate field name
     * @param value duplicate value
     */
    public DuplicateException(String field, Object value) {
        this(field, value, field + " 已存在: " + value);
    }

    /**
     * Factory method for duplicate exception with custom message.
     *
     * @param field duplicate field name
     * @param value duplicate value
     * @param message custom error message
     * @return exception instance
     */
    public static DuplicateException of(String field, Object value, String message) {
        return new DuplicateException(field, value, message);
    }

    /**
     * Factory method for duplicate exception with default message.
     *
     * @param field duplicate field name
     * @param value duplicate value
     * @return exception instance
     */
    public static DuplicateException of(String field, Object value) {
        return new DuplicateException(field, value);
    }
}
