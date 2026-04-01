package com.koduck.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * BusinessException 
 */
@DisplayName("业务异常测试")
class BusinessExceptionTest {

    @Test
    @DisplayName("使用错误码和消息创建异常")
    void constructor_withCodeAndMessage() {
        BusinessException exception = new BusinessException(1001, "测试错误");

        assertThat(exception.getCode()).isEqualTo(1001);
        assertThat(exception.getMessage()).isEqualTo("测试错误");
        assertThat(exception.getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST.value());
    }

    @Test
    @DisplayName("使用默认构造创建异常")
    void constructor_withMessageOnly() {
        BusinessException exception = new BusinessException("业务错误");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.BUSINESS_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("业务错误");
    }

    @Test
    @DisplayName("使用 ErrorCode 枚举创建异常")
    void constructor_withErrorCode() {
        BusinessException exception = new BusinessException(ErrorCode.USER_NOT_FOUND);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.USER_NOT_FOUND.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.USER_NOT_FOUND.getDefaultMessage());
    }

    @Test
    @DisplayName("使用 ErrorCode 和自定义消息创建异常")
    void constructor_withErrorCodeAndMessage() {
        BusinessException exception = new BusinessException(ErrorCode.USER_NOT_FOUND, "自定义消息");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.USER_NOT_FOUND.getCode());
        assertThat(exception.getMessage()).isEqualTo("自定义消息");
    }

    @Test
    @DisplayName("使用 ErrorCode 和 cause 创建异常")
    void constructor_withErrorCodeAndCause() {
        Throwable cause = new RuntimeException("原始异常");
        BusinessException exception = new BusinessException(ErrorCode.UNKNOWN_ERROR, cause);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.UNKNOWN_ERROR.getCode());
        assertThat(exception.getCause()).isEqualTo(cause);
    }

    @Test
    @DisplayName("获取正确的 HTTP 状态码")
    void getHttpStatus_shouldReturnCorrectValue() {
        BusinessException exception = new BusinessException(ErrorCode.NOT_FOUND);
        assertThat(exception.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND.value());

        BusinessException authException = new BusinessException(ErrorCode.UNAUTHORIZED);
        assertThat(authException.getHttpStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    @DisplayName("使用错误码、消息和 cause 创建异常")
    void constructor_withCodeMessageAndCause() {
        Throwable cause = new IllegalArgumentException("参数错误");
        BusinessException exception = new BusinessException(2000, "业务错误", cause);

        assertThat(exception.getCode()).isEqualTo(2000);
        assertThat(exception.getMessage()).isEqualTo("业务错误");
        assertThat(exception.getCause()).isEqualTo(cause);
    }
}
