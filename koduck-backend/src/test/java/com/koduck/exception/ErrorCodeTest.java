package com.koduck.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ErrorCode 枚举单元测试。
 */
@DisplayName("错误码枚举测试")
class ErrorCodeTest {

    @Test
    @DisplayName("错误码应该包含正确的属性")
    void shouldHaveCorrectProperties() {
        ErrorCode success = ErrorCode.SUCCESS;
        assertThat(success.getCode()).isEqualTo(0);
        assertThat(success.getDefaultMessage()).isEqualTo("success");
        assertThat(success.getHttpStatus()).isEqualTo(HttpStatus.OK);
    }

    @Test
    @DisplayName("根据错误码查找枚举应该正确工作")
    void fromCode_shouldReturnCorrectEnum() {
        ErrorCode result = ErrorCode.fromCode(0);
        assertThat(result).isEqualTo(ErrorCode.SUCCESS);

        ErrorCode notFound = ErrorCode.fromCode(1004);
        assertThat(notFound).isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    @DisplayName("找不到错误码时应该返回 UNKNOWN_ERROR")
    void fromCode_shouldReturnUnknownErrorForInvalidCode() {
        ErrorCode result = ErrorCode.fromCode(999999);
        assertThat(result).isEqualTo(ErrorCode.UNKNOWN_ERROR);
    }

    @Test
    @DisplayName("认证相关错误码应该有正确的 HTTP 状态")
    void authErrorCodes_shouldHaveUnauthorizedOrForbiddenStatus() {
        assertThat(ErrorCode.AUTH_INVALID_CREDENTIALS.getHttpStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(ErrorCode.AUTH_TOKEN_EXPIRED.getHttpStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(ErrorCode.AUTH_ACCESS_DENIED.getHttpStatus()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ErrorCode.AUTH_ACCOUNT_DISABLED.getHttpStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("资源相关错误码应该有正确的 HTTP 状态")
    void resourceErrorCodes_shouldHaveCorrectStatus() {
        assertThat(ErrorCode.RESOURCE_NOT_FOUND.getHttpStatus()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(ErrorCode.DUPLICATE_ERROR.getHttpStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(ErrorCode.RESOURCE_CONFLICT.getHttpStatus()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("所有错误码应该有唯一的状态码")
    void allErrorCodes_shouldHaveUniqueCode() {
        int[] codes = java.util.Arrays.stream(ErrorCode.values())
                .mapToInt(ErrorCode::getCode)
                .toArray();

        long uniqueCount = java.util.Arrays.stream(codes).distinct().count();
        assertThat(uniqueCount).isEqualTo(ErrorCode.values().length);
    }
}
