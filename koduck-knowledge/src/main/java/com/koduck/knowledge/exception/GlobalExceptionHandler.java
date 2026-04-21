package com.koduck.knowledge.exception;

import com.koduck.knowledge.dto.ErrorResponse;
import jakarta.validation.ConstraintViolationException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(KnowledgeException.class)
    public ResponseEntity<ErrorResponse> handleKnowledgeException(final KnowledgeException exception) {
        final Map<String, Object> details = exception.getDetails().isEmpty() ? null : exception.getDetails();
        log.warn(
                "KnowledgeException handled status={} code={} message={}",
                exception.getStatus().value(),
                exception.getCode(),
                exception.getMessage());
        return ResponseEntity.status(exception.getStatus())
                .body(new ErrorResponse(exception.getCode(), exception.getMessage(), details));
    }

    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        BindException.class,
        ConstraintViolationException.class
    })
    public ResponseEntity<ErrorResponse> handleValidationException(final Exception exception) {
        final Map<String, Object> details = new LinkedHashMap<>();
        details.put("reason", exception.getClass().getSimpleName());
        log.warn(
                "Validation exception handled type={} message={}",
                exception.getClass().getSimpleName(),
                exception.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("INVALID_ARGUMENT", "Request validation failed", details));
    }

    @ExceptionHandler({
        NoResourceFoundException.class,
        NoHandlerFoundException.class
    })
    public ResponseEntity<ErrorResponse> handleNotFoundException(final Exception exception) {
        final Map<String, Object> details = new LinkedHashMap<>();
        details.put("reason", exception.getClass().getSimpleName());
        log.warn(
                "Not found exception handled type={} message={}",
                exception.getClass().getSimpleName(),
                exception.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("NOT_FOUND", "Resource not found", details));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpectedException(final Exception exception) {
        log.error("Unhandled exception in knowledge service", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("INTERNAL_ERROR", "Unexpected server error", null));
    }
}
