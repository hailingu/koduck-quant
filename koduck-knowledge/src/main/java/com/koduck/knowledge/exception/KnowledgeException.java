package com.koduck.knowledge.exception;

import java.util.Map;
import java.io.Serial;
import org.springframework.http.HttpStatus;

public class KnowledgeException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    private final HttpStatus status;
    private final String code;
    private final transient Map<String, Object> details;

    public KnowledgeException(final HttpStatus status, final String code, final String message) {
        this(status, code, message, Map.of());
    }

    public KnowledgeException(
            final HttpStatus status,
            final String code,
            final String message,
            final Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public Map<String, Object> getDetails() {
        return details;
    }
}
