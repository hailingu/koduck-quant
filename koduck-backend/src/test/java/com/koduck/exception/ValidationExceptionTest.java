package com.koduck.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * ValidationException 测试类.
 *
 * @author Koduck Team
 */
@DisplayName("参数校验异常测试")
class ValidationExceptionTest {

    @Test
    @DisplayName("使用消息创建异常")
    void constructorWithMessage() {
        String message = "参数错误";
        ValidationException exception = new ValidationException(message);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo(message);
        assertThat(exception.getFieldErrors()).isEmpty();
    }

    @Test
    @DisplayName("使用 ErrorCode 创建异常")
    void constructorWithErrorCode() {
        ValidationException exception = new ValidationException(ErrorCode.BAD_REQUEST);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.BAD_REQUEST.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.BAD_REQUEST.getDefaultMessage());
    }

    @Test
    @DisplayName("使用消息和字段错误创建异常")
    void constructorWithMessageAndFieldErrors() {
        Map<String, String> errors = Map.of(
            "username", "用户名不能为空",
            "email", "邮箱格式错误");
        String message = "校验失败";
        ValidationException exception = new ValidationException(message, errors);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo(message);
        assertThat(exception.getFieldErrors()).hasSize(2);
        assertThat(exception.getFieldErrors()).containsEntry("username", "用户名不能为空");
    }

    @Test
    @DisplayName("使用 forField 静态方法创建异常")
    void forFieldShouldCreateExceptionWithFieldError() {
        String fieldName = "password";
        String errorMessage = "密码不能为空";
        ValidationException exception = ValidationException.forField(fieldName, errorMessage);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo(errorMessage);
        assertThat(exception.getFieldErrors()).hasSize(1);
        assertThat(exception.getFieldErrors()).containsEntry(fieldName, errorMessage);
    }

    @Test
    @DisplayName("空字段错误映射应该转换为空 Map")
    void constructorWithNullFieldErrorsShouldConvertToEmptyMap() {
        String message = "校验失败";
        ValidationException exception = new ValidationException(message, null);

        assertThat(exception.getFieldErrors()).isNotNull();
        assertThat(exception.getFieldErrors()).isEmpty();
    }
}
