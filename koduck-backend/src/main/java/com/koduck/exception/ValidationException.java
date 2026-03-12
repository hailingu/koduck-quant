package com.koduck.exception;

import lombok.Getter;

import java.util.Collections;
import java.util.Map;

/**
 * 
 *
 * <p>，</p>
 *
 * @author Koduck Team
 */
@Getter
public class ValidationException extends BusinessException {

    /**
     * ，key ，value 
     */
    private final Map<String, String> fieldErrors;

    /**
     * 
     *
     * @param message 
     */
    public ValidationException(String message) {
        super(ErrorCode.VALIDATION_ERROR.getCode(), message);
        this.fieldErrors = Collections.emptyMap();
    }

    /**
     * 
     *
     * @param errorCode 
     */
    public ValidationException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.fieldErrors = Collections.emptyMap();
    }

    /**
     * （）
     *
     * @param message     
     * @param fieldErrors 
     */
    public ValidationException(String message, Map<String, String> fieldErrors) {
        super(ErrorCode.VALIDATION_ERROR.getCode(), message);
        this.fieldErrors = fieldErrors != null ? Map.copyOf(fieldErrors) : Collections.emptyMap();
    }

    /**
     * （）
     *
     * @param field   
     * @param message 
     * @return ValidationException
     */
    public static ValidationException forField(String field, String message) {
        return new ValidationException(message, Map.of(field, message));
    }
}
