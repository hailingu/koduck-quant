package com.koduck.exception;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.validation.BindException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.koduck.dto.ApiResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;

/**
 * Global REST exception handler.
 *
 * <p>Converts domain, validation, security and framework exceptions into
 * unified {@link ApiResponse} payloads.</p>
 *
 * @author Koduck Team
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles all {@link BusinessException} and maps status from {@link ErrorCode}.
     *
     * @param e business exception
     * @return unified error response
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        log.warn("Business exception: code={}, message={}", e.getCode(), e.getMessage());
        ErrorCode errorCode = ErrorCode.fromCode(e.getCode());
        HttpStatus status = Objects.requireNonNull(errorCode.getHttpStatus(), "httpStatus must not be null");
        return buildErrorResponse(status, e.getCode(), e.getMessage());
    }

    /**
     * Handles {@link ResourceNotFoundException}.
     *
     * @param e resource-not-found exception
     * @return 404 error response
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceNotFoundException(ResourceNotFoundException e) {
        log.warn("Resource not found: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.NOT_FOUND, e.getCode(), e.getMessage());
    }

    /**
     * Handles {@link ValidationException}.
     *
     * @param e validation exception
     * @return 400 error response
     */
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(ValidationException e) {
        log.warn("Validation failed: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, e.getCode(), e.getMessage());
    }

    /**
     * Handles {@link DuplicateException}.
     *
     * @param e duplicate exception
     * @return 409 error response
     */
    @ExceptionHandler(DuplicateException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateException(DuplicateException e) {
        log.warn("Duplicate data: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.CONFLICT, e.getCode(), e.getMessage());
    }

    /**
     * Handles custom authentication exception from domain layer.
     *
     * @param e authentication exception
     * @return 401 error response
     */
    @ExceptionHandler(com.koduck.exception.AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleCustomAuthenticationException(
            com.koduck.exception.AuthenticationException e) {
        log.warn("Authentication failed: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.UNAUTHORIZED, e.getCode(), e.getMessage());
    }

    /**
     * Handles {@link AuthorizationException}.
     *
     * @param e authorization exception
     * @return 403 error response
     */
    @ExceptionHandler(AuthorizationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthorizationException(AuthorizationException e) {
        log.warn("Authorization failed: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, e.getCode(), e.getMessage());
    }

    /**
     * Handles {@link StateException}.
     *
     * @param e invalid-state exception
     * @return 400 error response
     */
    @ExceptionHandler(StateException.class)
    public ResponseEntity<ApiResponse<Void>> handleStateException(StateException e) {
        log.warn("Invalid state: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, e.getCode(), e.getMessage());
    }

    /**
     * Handles {@link ExternalServiceException} for downstream dependency failures.
     *
     * @param e external service exception
     * @return 502 error response
     */
    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<ApiResponse<Void>> handleExternalServiceException(ExternalServiceException e) {
        log.error("External service error: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_GATEWAY, e.getCode(), e.getMessage());
    }

    // ========== Spring Validation  ==========

    /**
     * Handles bean validation errors raised by {@code @Valid}.
     *
     * @param e method argument validation exception
     * @return 400 error response with aggregated field messages
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentNotValidException(
            MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.warn("Validation failed: {}", message);
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR.getCode(),
            "参数校验失败: " + message);
    }

    /**
     * Handles binding failures for request parameters/form fields.
     *
     * @param e bind exception
     * @return 400 error response with binding details
     */
    @ExceptionHandler(BindException.class)
    public ResponseEntity<ApiResponse<Void>> handleBindException(BindException e) {
        String message = e.getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.warn("Bind failed: {}", message);
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR.getCode(),
            "参数绑定失败: " + message);
    }

    /**
     * Handles constraint violations raised by {@code @Validated}.
     *
     * @param e constraint violation exception
     * @return 400 error response with violation details
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraintViolationException(
            ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
                .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                .collect(Collectors.joining(", "));
        log.warn("Constraint violation: {}", message);
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR.getCode(),
            "参数校验失败: " + message);
    }

    /**
     * Handles missing required request parameter errors.
     *
     * @param e missing-parameter exception
     * @return 400 error response
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingServletRequestParameterException(
            MissingServletRequestParameterException e) {
        String message = "缺少必要参数: " + e.getParameterName();
        log.warn(message);
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST.getCode(), message);
    }

    /**
     * Handles request parameter type mismatch errors.
     *
     * @param e type mismatch exception
     * @return 400 error response
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodArgumentTypeMismatchException(
            MethodArgumentTypeMismatchException e) {
        Class<?> requiredType = e.getRequiredType();
        String requiredTypeName = requiredType == null ? "unknown" : requiredType.getSimpleName();
        String message = String.format("参数类型错误: %s 期望类型 %s",
            e.getName(), requiredTypeName);
        log.warn(message);
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST.getCode(), message);
    }

    /**
     * Handles malformed JSON or unreadable request body errors.
     *
     * @param e message-not-readable exception
     * @return 400 error response
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadableException(
            HttpMessageNotReadableException e) {
        String message = "请求体格式错误，请检查 JSON 格式";
        log.warn("Message not readable: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST.getCode(), message);
    }

    /**
     * Handles unsupported HTTP method errors.
     *
     * @param e method-not-supported exception
     * @return 405 error response
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpRequestMethodNotSupportedException(
            HttpRequestMethodNotSupportedException e) {
        String message = "请求方法不支持: " + e.getMethod();
        log.warn(message);
        return buildErrorResponse(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED.getCode(), message);
    }

    /**
     * Handles unmatched route errors when no handler is found.
     *
     * @param e no-handler exception
     * @return 404 error response
     */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoHandlerFoundException(NoHandlerFoundException e) {
        String message = "请求路径不存在: " + e.getRequestURL();
        log.warn(message);
        return buildErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND.getCode(), message);
    }

    /**
     * Handles static-resource route miss errors.
     *
     * @param e no-resource exception
     * @return 404 error response
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFoundException(NoResourceFoundException e) {
        String message = "请求路径不存在: " + e.getResourcePath();
        log.warn(message);
        return buildErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND.getCode(), message);
    }

    // ========== Spring Security  ==========

    /**
     * Handles Spring Security bad-credentials errors.
     *
     * @param e bad credentials exception
     * @return 401 error response
     */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentialsException(BadCredentialsException e) {
        log.warn("Bad credentials");
        return buildErrorResponse(HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_INVALID_CREDENTIALS.getCode(),
            ErrorCode.AUTH_INVALID_CREDENTIALS.getDefaultMessage());
    }

    /**
     * Handles disabled-account authentication errors.
     *
     * @param e disabled exception
     * @return 403 error response
     */
    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ApiResponse<Void>> handleDisabledException(DisabledException e) {
        log.warn("Account disabled");
        return buildErrorResponse(HttpStatus.FORBIDDEN, ErrorCode.AUTH_ACCOUNT_DISABLED.getCode(),
            ErrorCode.AUTH_ACCOUNT_DISABLED.getDefaultMessage());
    }

    /**
     * Handles locked-account authentication errors.
     *
     * @param e locked exception
     * @return 403 error response
     */
    @ExceptionHandler(LockedException.class)
    public ResponseEntity<ApiResponse<Void>> handleLockedException(LockedException e) {
        log.warn("Account locked");
        return buildErrorResponse(HttpStatus.FORBIDDEN, ErrorCode.AUTH_ACCOUNT_LOCKED.getCode(),
            ErrorCode.AUTH_ACCOUNT_LOCKED.getDefaultMessage());
    }

    /**
     * Handles Spring Security access-denied errors.
     *
     * @param e access denied exception
     * @return 403 error response
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(AccessDeniedException e) {
        log.warn("Access denied: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN.getCode(),
            "权限不足，拒绝访问");
    }

    /**
     * Handles {@link IllegalArgumentException} from service/controller layer.
     *
     * @param e illegal argument exception
     * @return 400 error response
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(IllegalArgumentException e) {
        log.warn("Illegal argument: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST.getCode(),
            e.getMessage() != null ? e.getMessage() : "参数错误");
    }

    /**
     * Handles {@link IllegalStateException} from service/controller layer.
     *
     * @param e illegal state exception
     * @return 400 error response
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalStateException(IllegalStateException e) {
        log.warn("Illegal state: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_STATE.getCode(),
            e.getMessage() != null ? e.getMessage() : "状态异常");
    }

    /**
     * Handles uncaught exceptions as final fallback.
     *
     * @param e unexpected exception
     * @param request HTTP request
     * @return 500 error response
     */
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleException(Exception e, HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        log.error("Unexpected error occurred at [{}]: {}", requestUri, e.getMessage(), e);
        return ApiResponse.error(ErrorCode.UNKNOWN_ERROR.getCode(),
                "系统内部错误，请稍后重试");
    }

    /**
     * Builds unified API error response with given status/code/message.
     *
     * @param status HTTP status
     * @param code business error code
     * @param message error message
     * @return response entity containing unified error payload
     */
    private ResponseEntity<ApiResponse<Void>> buildErrorResponse(HttpStatus status, int code, String message) {
        ApiResponse<Void> response = ApiResponse.error(code, message);
        return ResponseEntity.status(status.value()).body(response);
    }
}
