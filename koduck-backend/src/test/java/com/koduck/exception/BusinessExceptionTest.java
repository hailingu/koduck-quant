package com.koduck.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/**
 * BusinessException 测试类.
 *
 * @author Koduck Team
 */
@DisplayName("业务异常测试")
class BusinessExceptionTest {

    /** Custom error code one. */
    private static final int CUSTOM_ERROR_CODE_ONE = 1001;

    /** Custom error code two. */
    private static final int CUSTOM_ERROR_CODE_TWO = 2000;

    @Test
    @DisplayName("使用错误码和消息创建异常")
    void constructorWithCodeAndMessage() {
        String message = "测试错误";
        BusinessException exception = new BusinessException(CUSTOM_ERROR_CODE_ONE, message);

        assertThat(exception.getCode()).isEqualTo(CUSTOM_ERROR_CODE_ONE);
        assertThat(exception.getMessage()).isEqualTo(message);
        assertThat(exception.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
    }

    @Test
    @DisplayName("使用默认构造创建异常")
    void constructorWithMessageOnly() {
        String message = "业务错误";
        BusinessException exception = new BusinessException(message);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.BUSINESS_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo(message);
    }

    @Test
    @DisplayName("使用 ErrorCode 枚举创建异常")
    void constructorWithErrorCode() {
        BusinessException exception = new BusinessException(ErrorCode.USER_NOT_FOUND);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.USER_NOT_FOUND.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.USER_NOT_FOUND.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 ErrorCode 和自定义消息创建异常")
    void constructorWithErrorCodeAndMessage() {
        String message = "自定义消息";
        BusinessException exception = new BusinessException(ErrorCode.USER_NOT_FOUND, message);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.USER_NOT_FOUND.getCode());
        assertThat(exception.getMessage()).isEqualTo(message);
    }

    @Test
    @DisplayName("使用 ErrorCode 和 cause 创建异常")
    void constructorWithErrorCodeAndCause() {
        String causeMessage = "原始异常";
        Throwable cause = new RuntimeException(causeMessage);
        BusinessException exception = new BusinessException(ErrorCode.UNKNOWN_ERROR, cause);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.UNKNOWN_ERROR.getCode());
        assertThat(exception.getCause()).isEqualTo(cause);
    }

    @Test
    @DisplayName("获取正确的 HTTP 状态码")
    void getHttpStatusShouldReturnCorrectValue() {
        BusinessException exception = new BusinessException(ErrorCode.NOT_FOUND);
        assertThat(exception.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());

        BusinessException authException = new BusinessException(ErrorCode.UNAUTHORIZED);
        assertThat(authException.getHttpStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    @DisplayName("使用错误码、消息和 cause 创建异常")
    void constructorWithCodeMessageAndCause() {
        String causeMessage = "参数错误";
        String message = "业务错误";
        Throwable cause = new IllegalArgumentException(causeMessage);
        BusinessException exception = new BusinessException(CUSTOM_ERROR_CODE_TWO, message, cause);

        assertThat(exception.getCode()).isEqualTo(CUSTOM_ERROR_CODE_TWO);
        assertThat(exception.getMessage()).isEqualTo(message);
        assertThat(exception.getCause()).isEqualTo(cause);
    }
}
