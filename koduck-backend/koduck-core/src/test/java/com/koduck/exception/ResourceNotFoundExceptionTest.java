package com.koduck.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ResourceNotFoundException 测试类.
 *
 * @author Koduck Team
 */
@DisplayName("资源不存在异常测试")
class ResourceNotFoundExceptionTest {

    /** Resource ID constant one. */
    private static final Long RESOURCE_ID_ONE = 123L;

    /** Resource ID constant two. */
    private static final Long RESOURCE_ID_TWO = 456L;

    /** Resource type constant. */
    private static final String RESOURCE_TYPE_USER = "用户";

    /** Resource type constant for credential. */
    private static final String RESOURCE_TYPE_CREDENTIAL = "凭证";

    /** Resource type constant for stock. */
    private static final String RESOURCE_TYPE_STOCK = "股票";

    /** Stock symbol constant. */
    private static final String STOCK_SYMBOL = "AAPL";

    @Test
    @DisplayName("使用消息创建异常")
    void constructorWithMessage() {
        String message = "资源不存在";
        ResourceNotFoundException exception = new ResourceNotFoundException(message);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND.getCode());
        assertThat(exception.getMessage()).isEqualTo(message);
        assertThat(exception.getResourceType()).isNull();
        assertThat(exception.getResourceId()).isNull();
    }

    @Test
    @DisplayName("使用 ErrorCode 创建异常")
    void constructorWithErrorCode() {
        ResourceNotFoundException exception = new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.USER_NOT_FOUND.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.USER_NOT_FOUND.getDefaultMessage());
    }

    @Test
    @DisplayName("使用资源类型和 ID 创建异常")
    void constructorWithResourceTypeAndId() {
        ResourceNotFoundException exception = new ResourceNotFoundException(
            RESOURCE_TYPE_USER, RESOURCE_ID_ONE);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND.getCode());
        assertThat(exception.getMessage()).isEqualTo("用户不存在: 123");
        assertThat(exception.getResourceType()).isEqualTo(RESOURCE_TYPE_USER);
        assertThat(exception.getResourceId()).isEqualTo(RESOURCE_ID_ONE);
    }

    @Test
    @DisplayName("使用 ErrorCode、资源类型和 ID 创建异常")
    void constructorWithErrorCodeResourceTypeAndId() {
        ResourceNotFoundException exception = new ResourceNotFoundException(
                ErrorCode.CREDENTIAL_NOT_FOUND, RESOURCE_TYPE_CREDENTIAL, RESOURCE_ID_TWO);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.CREDENTIAL_NOT_FOUND.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.CREDENTIAL_NOT_FOUND.getDefaultMessage());
        assertThat(exception.getResourceType()).isEqualTo(RESOURCE_TYPE_CREDENTIAL);
        assertThat(exception.getResourceId()).isEqualTo(RESOURCE_ID_TWO);
    }

    @Test
    @DisplayName("使用 of 静态方法创建异常")
    void ofShouldCreateException() {
        ResourceNotFoundException exception = ResourceNotFoundException.of(
            RESOURCE_TYPE_STOCK, STOCK_SYMBOL);

        assertThat(exception.getResourceType()).isEqualTo(RESOURCE_TYPE_STOCK);
        assertThat(exception.getResourceId()).isEqualTo(STOCK_SYMBOL);
        assertThat(exception.getMessage()).contains(RESOURCE_TYPE_STOCK).contains(STOCK_SYMBOL);
    }
}
