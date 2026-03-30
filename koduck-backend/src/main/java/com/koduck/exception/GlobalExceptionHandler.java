package com.koduck.exception;

import com.koduck.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
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
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 
 *
 * <p>， API </p>
 *
 * @author Koduck Team
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        log.warn("Business exception: code={}, message={}", e.getCode(), e.getMessage());
        ErrorCode errorCode = ErrorCode.fromCode(e.getCode());
        HttpStatus status = Objects.requireNonNull(errorCode.getHttpStatus(), "httpStatus must not be null");
        return buildErrorResponse(status, e.getCode(), e.getMessage());
    }

    /**
     * 
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleResourceNotFoundException(ResourceNotFoundException e) {
        log.warn("Resource not found: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.NOT_FOUND, e.getCode(), e.getMessage());
    }

    /**
     * 
     */
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(ValidationException e) {
        log.warn("Validation failed: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, e.getCode(), e.getMessage());
    }

    /**
     * 
     */
    @ExceptionHandler(DuplicateException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateException(DuplicateException e) {
        log.warn("Duplicate data: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.CONFLICT, e.getCode(), e.getMessage());
    }

    /**
     * （）
     */
    @ExceptionHandler(com.koduck.exception.AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleCustomAuthenticationException(
            com.koduck.exception.AuthenticationException e) {
        log.warn("Authentication failed: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.UNAUTHORIZED, e.getCode(), e.getMessage());
    }

    /**
     * 
     */
    @ExceptionHandler(AuthorizationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthorizationException(AuthorizationException e) {
        log.warn("Authorization failed: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, e.getCode(), e.getMessage());
    }

    /**
     * 
     */
    @ExceptionHandler(StateException.class)
    public ResponseEntity<ApiResponse<Void>> handleStateException(StateException e) {
        log.warn("Invalid state: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, e.getCode(), e.getMessage());
    }

    /**
     * 
     */
    @ExceptionHandler(ExternalServiceException.class)
    public ResponseEntity<ApiResponse<Void>> handleExternalServiceException(ExternalServiceException e) {
        log.error("External service error: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_GATEWAY, e.getCode(), e.getMessage());
    }

    // ========== Spring Validation  ==========

    /**
     * （@Valid）
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
     * 
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
     * （@Validated）
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

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingServletRequestParameterException(
            MissingServletRequestParameterException e) {
        String message = "缺少必要参数: " + e.getParameterName();
        log.warn(message);
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST.getCode(), message);
    }

    /**
     * 
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
     * 
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpMessageNotReadableException(
            HttpMessageNotReadableException e) {
        String message = "请求体格式错误，请检查 JSON 格式";
        log.warn("Message not readable: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST.getCode(), message);
    }

    /**
     * 
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleHttpRequestMethodNotSupportedException(
            HttpRequestMethodNotSupportedException e) {
        String message = "请求方法不支持: " + e.getMethod();
        log.warn(message);
        return buildErrorResponse(HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.METHOD_NOT_ALLOWED.getCode(), message);
    }

    /**
     * 
     */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoHandlerFoundException(NoHandlerFoundException e) {
        String message = "请求路径不存在: " + e.getRequestURL();
        log.warn(message);
        return buildErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND.getCode(), message);
    }

    /**
     * 
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFoundException(NoResourceFoundException e) {
        String message = "请求路径不存在: " + e.getResourcePath();
        log.warn(message);
        return buildErrorResponse(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND.getCode(), message);
    }

    // ========== Spring Security  ==========

    /**
     *  Spring Security 
     */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentialsException(BadCredentialsException e) {
        log.warn("Bad credentials");
        return buildErrorResponse(HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_INVALID_CREDENTIALS.getCode(),
            ErrorCode.AUTH_INVALID_CREDENTIALS.getDefaultMessage());
    }

    /**
     * 
     */
    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<ApiResponse<Void>> handleDisabledException(DisabledException e) {
        log.warn("Account disabled");
        return buildErrorResponse(HttpStatus.FORBIDDEN, ErrorCode.AUTH_ACCOUNT_DISABLED.getCode(),
            ErrorCode.AUTH_ACCOUNT_DISABLED.getDefaultMessage());
    }

    /**
     * 
     */
    @ExceptionHandler(LockedException.class)
    public ResponseEntity<ApiResponse<Void>> handleLockedException(LockedException e) {
        log.warn("Account locked");
        return buildErrorResponse(HttpStatus.FORBIDDEN, ErrorCode.AUTH_ACCOUNT_LOCKED.getCode(),
            ErrorCode.AUTH_ACCOUNT_LOCKED.getDefaultMessage());
    }

    /**
     *  Spring Security 
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDeniedException(AccessDeniedException e) {
        log.warn("Access denied: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN.getCode(),
            "权限不足，拒绝访问");
    }

    /**
     * 
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(IllegalArgumentException e) {
        log.warn("Illegal argument: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST.getCode(),
            e.getMessage() != null ? e.getMessage() : "参数错误");
    }

    /**
     * 
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalStateException(IllegalStateException e) {
        log.warn("Illegal state: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_STATE.getCode(),
            e.getMessage() != null ? e.getMessage() : "状态异常");
    }

    /**
     * 
     */
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleException(Exception e, HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        log.error("Unexpected error occurred at [{}]: {}", requestUri, e.getMessage(), e);
        return ApiResponse.error(ErrorCode.UNKNOWN_ERROR.getCode(),
                "系统内部错误，请稍后重试");
    }

    private ResponseEntity<ApiResponse<Void>> buildErrorResponse(HttpStatus status, int code, String message) {
        ApiResponse<Void> response = ApiResponse.error(code, message);
        return ResponseEntity.status(status.value()).body(response);
    }
}
