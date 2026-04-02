package com.koduck.exception;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * DuplicateException 测试类.
 *
 * @author Koduck Team
 */
@DisplayName("数据重复异常测试")
class DuplicateExceptionTest {

    @Test
    @DisplayName("使用消息创建异常")
    void constructorWithMessage() {
        DuplicateException exception = new DuplicateException("数据重复");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.DUPLICATE_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("数据重复");
        assertThat(exception.getField()).isNull();
        assertThat(exception.getValue()).isNull();
    }

    @Test
    @DisplayName("使用 ErrorCode 创建异常")
    void constructorWithErrorCode() {
        DuplicateException exception = new DuplicateException(ErrorCode.USER_USERNAME_EXISTS);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.USER_USERNAME_EXISTS.getCode());
        assertThat(exception.getMessage())
            .isEqualTo(ErrorCode.USER_USERNAME_EXISTS.getDefaultMessage());
    }

    @Test
    @DisplayName("使用字段和值创建异常")
    void constructorWithFieldAndValue() {
        String fieldName = "username";
        String fieldValue = "testuser";
        DuplicateException exception = new DuplicateException(fieldName, fieldValue);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.DUPLICATE_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("username 已存在: testuser");
        assertThat(exception.getField()).isEqualTo(fieldName);
        assertThat(exception.getValue()).isEqualTo(fieldValue);
    }

    @Test
    @DisplayName("使用字段、值和自定义消息创建异常")
    void constructorWithFieldValueAndMessage() {
        String fieldName = "email";
        String fieldValue = "test@example.com";
        String message = "该邮箱已被注册";
        DuplicateException exception = new DuplicateException(fieldName, fieldValue, message);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.DUPLICATE_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo(message);
        assertThat(exception.getField()).isEqualTo(fieldName);
        assertThat(exception.getValue()).isEqualTo(fieldValue);
    }

    @Test
    @DisplayName("使用 of 静态方法创建异常")
    void ofShouldCreateException() {
        String fieldName = "username";
        String fieldValue = "testuser";
        DuplicateException exception = DuplicateException.of(fieldName, fieldValue);

        assertThat(exception.getField()).isEqualTo(fieldName);
        assertThat(exception.getValue()).isEqualTo(fieldValue);
        assertThat(exception.getMessage()).contains(fieldName).contains(fieldValue);
    }

    @Test
    @DisplayName("使用 of 静态方法创建异常（带自定义消息）")
    void ofWithMessageShouldCreateException() {
        String fieldName = "email";
        String fieldValue = "test@example.com";
        String message = "邮箱已被占用";
        DuplicateException exception = DuplicateException.of(fieldName, fieldValue, message);

        assertThat(exception.getField()).isEqualTo(fieldName);
        assertThat(exception.getValue()).isEqualTo(fieldValue);
        assertThat(exception.getMessage()).isEqualTo(message);
    }
}
