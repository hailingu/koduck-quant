package com.koduck.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ValidationException 
 */
@DisplayName("参数校验异常测试")
class ValidationExceptionTest {

    @Test
    @DisplayName("使用消息创建异常")
    void constructor_withMessage() {
        ValidationException exception = new ValidationException("参数错误");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("参数错误");
        assertThat(exception.getFieldErrors()).isEmpty();
    }

    @Test
    @DisplayName("使用 ErrorCode 创建异常")
    void constructor_withErrorCode() {
        ValidationException exception = new ValidationException(ErrorCode.BAD_REQUEST);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.BAD_REQUEST.getCode());
        assertThat(exception.getMessage()).isEqualTo(ErrorCode.BAD_REQUEST.getDefaultMessage());
    }

    @Test
    @DisplayName("使用消息和字段错误创建异常")
    void constructor_withMessageAndFieldErrors() {
        Map<String, String> errors = Map.of("username", "用户名不能为空", "email", "邮箱格式错误");
        ValidationException exception = new ValidationException("校验失败", errors);

        assertThat(exception.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("校验失败");
        assertThat(exception.getFieldErrors()).hasSize(2);
        assertThat(exception.getFieldErrors()).containsEntry("username", "用户名不能为空");
    }

    @Test
    @DisplayName("使用 forField 静态方法创建异常")
    void forField_shouldCreateExceptionWithFieldError() {
        ValidationException exception = ValidationException.forField("password", "密码不能为空");

        assertThat(exception.getCode()).isEqualTo(ErrorCode.VALIDATION_ERROR.getCode());
        assertThat(exception.getMessage()).isEqualTo("密码不能为空");
        assertThat(exception.getFieldErrors()).hasSize(1);
        assertThat(exception.getFieldErrors()).containsEntry("password", "密码不能为空");
    }

    @Test
    @DisplayName("空字段错误映射应该转换为空 Map")
    void constructor_withNullFieldErrors_shouldConvertToEmptyMap() {
        ValidationException exception = new ValidationException("校验失败", null);

        assertThat(exception.getFieldErrors()).isNotNull();
        assertThat(exception.getFieldErrors()).isEmpty();
    }
}
