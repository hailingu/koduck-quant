package com.koduck.exception;

import lombok.Getter;

/**
 * 
 *
 * <p></p>
 *
 * @author Koduck Team
 */
@Getter
public class DuplicateException extends BusinessException {

    /**
     * 
     */
    private final String field;

    /**
     * 
     */
    private final Object value;

    /**
     * 
     *
     * @param message 
     */
    public DuplicateException(String message) {
        super(ErrorCode.DUPLICATE_ERROR.getCode(), message);
        this.field = null;
        this.value = null;
    }

    /**
     * 
     *
     * @param errorCode 
     */
    public DuplicateException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.field = null;
        this.value = null;
    }

    /**
     * 
     *
     * @param field   
     * @param value   
     * @param message 
     */
    public DuplicateException(String field, Object value, String message) {
        super(ErrorCode.DUPLICATE_ERROR.getCode(), message);
        this.field = field;
        this.value = value;
    }

    /**
     * （）
     *
     * @param field 
     * @param value 
     */
    public DuplicateException(String field, Object value) {
        this(field, value, field + " 已存在: " + value);
    }

    /**
     * 
     *
     * @param field   
     * @param value   
     * @param message 
     * @return DuplicateException
     */
    public static DuplicateException of(String field, Object value, String message) {
        return new DuplicateException(field, value, message);
    }

    /**
     * （）
     *
     * @param field 
     * @param value 
     * @return DuplicateException
     */
    public static DuplicateException of(String field, Object value) {
        return new DuplicateException(field, value);
    }
}
