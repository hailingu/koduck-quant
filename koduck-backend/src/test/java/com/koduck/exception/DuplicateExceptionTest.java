package com.koduck.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * DuplicateException 
 */
@DisplayName("数据重复异常测试")
class DuplicateExceptionTest {

    @Test
    @DisplayName("使用消息创建异常")
    void constructor_withMessage() {
        DuplicateException exception = new DuplicateException("数据重复");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.DUPLICATE_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("数据重复");
        assertThat(exception.getField()).isNull();
        assertThat(exception.getValue()).isNull();
    }

    @Test
    @DisplayName("使用 ErrorCode 创建异常")
    void constructor_withErrorCode() {
        DuplicateException exception = new DuplicateException(ErrorCode.USER_USERNAME_EXISTS);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.USER_USERNAME_EXISTS.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.USER_USERNAME_EXISTS.getDefaultMessage());
    }

    @Test
    @DisplayName("使用字段和值创建异常")
    void constructor_withFieldAndValue() {
        DuplicateException exception = new DuplicateException("username", "testuser");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.DUPLICATE_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("username 已存在: testuser");
        assertThat(exception.getField()).isEqualTo("username");
        assertThat(exception.getValue()).isEqualTo("testuser");
    }

    @Test
    @DisplayName("使用字段、值和自定义消息创建异常")
    void constructor_withFieldValueAndMessage() {
        DuplicateException exception = new DuplicateException("email", "test@example.com", "该邮箱已被注册");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.DUPLICATE_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("该邮箱已被注册");
        assertThat(exception.getField()).isEqualTo("email");
        assertThat(exception.getValue()).isEqualTo("test@example.com");
    }

    @Test
    @DisplayName("使用 of 静态方法创建异常")
    void of_shouldCreateException() {
        DuplicateException exception = DuplicateException.of("username", "testuser");

        assertThat(exception.getField()).isEqualTo("username");
        assertThat(exception.getValue()).isEqualTo("testuser");
        assertThat(exception.getMessage()).contains("username").contains("testuser");
    }

    @Test
    @DisplayName("使用 of 静态方法创建异常（带自定义消息）")
    void of_withMessage_shouldCreateException() {
        DuplicateException exception = DuplicateException.of("email", "test@example.com", "邮箱已被占用");

        assertThat(exception.getField()).isEqualTo("email");
        assertThat(exception.getValue()).isEqualTo("test@example.com");
        assertThat(exception.getMessage()).isEqualTo("邮箱已被占用");
    }
}
