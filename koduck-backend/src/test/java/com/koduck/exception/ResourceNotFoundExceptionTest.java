package com.koduck.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ResourceNotFoundException 
 */
@DisplayName("资源不存在异常测试")
class ResourceNotFoundExceptionTest {

    @Test
    @DisplayName("使用消息创建异常")
    void constructor_withMessage() {
        ResourceNotFoundException exception = new ResourceNotFoundException("资源不存在");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND.getCode());
        assertThat(exception.getMessage()).isEqualTo("资源不存在");
        assertThat(exception.getResourceType()).isNull();
        assertThat(exception.getResourceId()).isNull();
    }

    @Test
    @DisplayName("使用 ErrorCode 创建异常")
    void constructor_withErrorCode() {
        ResourceNotFoundException exception = new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.USER_NOT_FOUND.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.USER_NOT_FOUND.getDefaultMessage());
    }

    @Test
    @DisplayName("使用资源类型和 ID 创建异常")
    void constructor_withResourceTypeAndId() {
        ResourceNotFoundException exception = new ResourceNotFoundException("用户", 123L);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND.getCode());
        assertThat(exception.getMessage()).isEqualTo("用户不存在: 123");
        assertThat(exception.getResourceType()).isEqualTo("用户");
        assertThat(exception.getResourceId()).isEqualTo(123L);
    }

    @Test
    @DisplayName("使用 ErrorCode、资源类型和 ID 创建异常")
    void constructor_withErrorCodeResourceTypeAndId() {
        ResourceNotFoundException exception = new ResourceNotFoundException(
                ErrorCode.CREDENTIAL_NOT_FOUND, "凭证", 456L);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.CREDENTIAL_NOT_FOUND.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.CREDENTIAL_NOT_FOUND.getDefaultMessage());
        assertThat(exception.getResourceType()).isEqualTo("凭证");
        assertThat(exception.getResourceId()).isEqualTo(456L);
    }

    @Test
    @DisplayName("使用 of 静态方法创建异常")
    void of_shouldCreateException() {
        ResourceNotFoundException exception = ResourceNotFoundException.of("股票", "AAPL");

        assertThat(exception.getResourceType()).isEqualTo("股票");
        assertThat(exception.getResourceId()).isEqualTo("AAPL");
        assertThat(exception.getMessage()).contains("股票").contains("AAPL");
    }
}
