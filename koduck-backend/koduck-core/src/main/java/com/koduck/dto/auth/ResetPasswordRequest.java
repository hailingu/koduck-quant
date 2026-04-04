package com.koduck.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

/**
 * 重置密码请求 DTO。
 *
 * @author Koduck Team
 */
@Data
public class ResetPasswordRequest {

    /** 重置令牌. */
    @NotBlank(message = "重置令牌不能为空")
    private String token;

    /** 新密码. */
    @NotBlank(message = "新密码不能为空")
    @Size(min = 6, max = 100, message = "密码长度必须在6-100之间")
    private String newPassword;

    /** 确认密码. */
    @NotBlank(message = "确认密码不能为空")
    private String confirmPassword;
}
