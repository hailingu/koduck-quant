package com.koduck.exception;

import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.Serial;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Exception for request or business validation failures.
 *
 * <p>Besides the main message, it can carry field-level validation errors.</p>
 *
 * @author Koduck Team
 */
public class ValidationException extends BusinessException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * Field-level validation errors. Key is field name, value is error message.
     */
    @SuppressWarnings("serial")
    private final Map<String, String> fieldErrors;

    /**
     * Creates a validation exception with message only.
     *
     * @param message validation error message
     */
    public ValidationException(String message) {
        super(ErrorCode.VALIDATION_ERROR.getCode(), message);
        this.fieldErrors = Collections.emptyMap();
    }

    /**
     * Creates a validation exception from predefined error code.
     *
     * @param errorCode validation-related error code
     */
    public ValidationException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.fieldErrors = Collections.emptyMap();
    }

    /**
     * Creates a validation exception with field-level error details.
     *
     * @param message validation error message
     * @param fieldErrors field-level errors
     */
    public ValidationException(String message, Map<String, String> fieldErrors) {
        super(ErrorCode.VALIDATION_ERROR.getCode(), message);
        this.fieldErrors = fieldErrors != null ? Map.copyOf(fieldErrors) : Collections.emptyMap();
    }

    /**
     * Returns immutable copy of field-level errors.
     *
     * @return field-level errors
     */
    public Map<String, String> getFieldErrors() {
        return fieldErrors == null || fieldErrors.isEmpty()
                ? Collections.emptyMap()
                : Map.copyOf(new HashMap<>(fieldErrors));
    }

    /**
     * Creates a single-field validation exception.
     *
     * @param field field name
     * @param message validation message
     * @return exception instance
     */
    public static ValidationException forField(String field, String message) {
        return new ValidationException(message, Map.of(field, message));
    }

    /**
     * Custom serialization.
     *
     * @param out the output stream
     * @throws IOException if I/O error occurs
     */
    @Serial
    private void writeObject(ObjectOutputStream out) throws IOException {
        out.defaultWriteObject();
    }

    /**
     * Custom deserialization.
     *
     * @param in the input stream
     * @throws IOException if I/O error occurs
     * @throws ClassNotFoundException if class not found
     */
    @Serial
    private void readObject(ObjectInputStream in) throws IOException, ClassNotFoundException {
        in.defaultReadObject();
    }
}
