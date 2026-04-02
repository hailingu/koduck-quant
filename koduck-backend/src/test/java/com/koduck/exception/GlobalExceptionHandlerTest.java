package com.koduck.exception;

import jakarta.servlet.http.HttpServletRequest;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;

import com.koduck.dto.ApiResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * GlobalExceptionHandler 测试类.
 *
 * @author Koduck Team
 */
@DisplayName("全局异常处理器测试")
class GlobalExceptionHandlerTest {

    /** Resource ID for testing. */
    private static final Long TEST_RESOURCE_ID = 123L;

    /** Field name for duplicate test. */
    private static final String FIELD_NAME = "username";

    /** Field value for duplicate test. */
    private static final String FIELD_VALUE = "test";

    /** Error message for external service. */
    private static final String EXTERNAL_SERVICE_ERROR = "连接超时";

    /** Service name for external service. */
    private static final String SERVICE_NAME = "DataService";

    /** 异常处理器实例. */
    private GlobalExceptionHandler handler;

    /** HTTP 请求 mock. */
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
        request = mock(HttpServletRequest.class);
        when(request.getRequestURI()).thenReturn("/api/test");
    }

    @Test
    @DisplayName("处理业务异常")
    void handleBusinessExceptionShouldReturnCorrectResponse() {
        BusinessException exception = new BusinessException(ErrorCode.USER_NOT_FOUND);

        ResponseEntity<ApiResponse<Void>> response = handler.handleBusinessException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.USER_NOT_FOUND.getCode());
    }

    @Test
    @DisplayName("处理资源不存在异常")
    void handleResourceNotFoundExceptionShouldReturnNotFound() {
        ResourceNotFoundException exception = new ResourceNotFoundException(
            "用户", TEST_RESOURCE_ID);

        ResponseEntity<ApiResponse<Void>> response =
            handler.handleResourceNotFoundException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND.getCode());
    }

    @Test
    @DisplayName("处理参数校验异常")
    void handleValidationExceptionShouldReturnBadRequest() {
        ValidationException exception = new ValidationException("参数错误");

        ResponseEntity<ApiResponse<Void>> response =
            handler.handleValidationException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR.getCode());
    }

    @Test
    @DisplayName("处理数据重复异常")
    void handleDuplicateExceptionShouldReturnConflict() {
        DuplicateException exception = new DuplicateException(FIELD_NAME, FIELD_VALUE);

        ResponseEntity<ApiResponse<Void>> response = handler.handleDuplicateException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.DUPLICATE_ERROR.getCode());
    }

    @Test
    @DisplayName("处理认证异常")
    void handleAuthenticationExceptionShouldReturnUnauthorized() {
        com.koduck.exception.AuthenticationException exception =
                com.koduck.exception.AuthenticationException.invalidCredentials();

        ResponseEntity<ApiResponse<Void>> response =
            handler.handleCustomAuthenticationException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().getCode())
            .isEqualTo(ErrorCode.AUTH_INVALID_CREDENTIALS.getCode());
    }

    @Test
    @DisplayName("处理授权异常")
    void handleAuthorizationExceptionShouldReturnForbidden() {
        AuthorizationException exception = AuthorizationException.accessDenied();

        ResponseEntity<ApiResponse<Void>> response =
            handler.handleAuthorizationException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.AUTH_ACCESS_DENIED.getCode());
    }

    @Test
    @DisplayName("处理状态异常")
    void handleStateExceptionShouldReturnBadRequest() {
        StateException exception = new StateException("当前状态", "期望状态");

        ResponseEntity<ApiResponse<Void>> response = handler.handleStateException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.INVALID_STATE.getCode());
    }

    @Test
    @DisplayName("处理外部服务异常")
    void handleExternalServiceExceptionShouldReturnBadGateway() {
        ExternalServiceException exception = new ExternalServiceException(
            SERVICE_NAME, EXTERNAL_SERVICE_ERROR);

        ResponseEntity<ApiResponse<Void>> response =
            handler.handleExternalServiceException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(response.getBody().getCode())
            .isEqualTo(ErrorCode.EXTERNAL_SERVICE_ERROR.getCode());
    }

    @Test
    @DisplayName("处理非法参数异常")
    void handleIllegalArgumentExceptionShouldReturnBadRequest() {
        IllegalArgumentException exception = new IllegalArgumentException("非法参数");

        ResponseEntity<ApiResponse<Void>> response =
            handler.handleIllegalArgumentException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.BAD_REQUEST.getCode());
    }

    @Test
    @DisplayName("处理 Spring Security 认证失败异常")
    void handleBadCredentialsExceptionShouldReturnUnauthorized() {
        BadCredentialsException exception = new BadCredentialsException("Bad credentials");

        ResponseEntity<ApiResponse<Void>> response =
            handler.handleBadCredentialsException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().getCode())
            .isEqualTo(ErrorCode.AUTH_INVALID_CREDENTIALS.getCode());
    }

    @Test
    @DisplayName("处理账号禁用异常")
    void handleDisabledExceptionShouldReturnForbidden() {
        DisabledException exception = new DisabledException("User is disabled");

        ResponseEntity<ApiResponse<Void>> response = handler.handleDisabledException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().getCode())
            .isEqualTo(ErrorCode.AUTH_ACCOUNT_DISABLED.getCode());
    }

    @Test
    @DisplayName("处理访问拒绝异常")
    void handleAccessDeniedExceptionShouldReturnForbidden() {
        AccessDeniedException exception = new AccessDeniedException("Access denied");

        ResponseEntity<ApiResponse<Void>> response =
            handler.handleAccessDeniedException(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().getCode()).isEqualTo(ErrorCode.FORBIDDEN.getCode());
    }

    @Test
    @DisplayName("处理通用异常")
    void handleExceptionShouldReturnInternalServerError() {
        Exception exception = new RuntimeException("未知错误");

        ApiResponse<Void> response = handler.handleException(exception, request);

        assertThat(response.getCode()).isEqualTo(ErrorCode.UNKNOWN_ERROR.getCode());
        assertThat(response.getMessage()).contains("系统内部错误");
    }
}
