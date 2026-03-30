package com.koduck.exception;

import java.io.Serial;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * 
 *
 * <p>，</p>
 *
 * @author Koduck Team
 */
public class ValidationException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * ，key ，value 
     */
    private final transient Map<String, String> fieldErrors;

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
    
    public Map<String, String> getFieldErrors() {
        return fieldErrors == null || fieldErrors.isEmpty()
                ? Collections.emptyMap()
                : Map.copyOf(new HashMap<>(fieldErrors));
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
