package com.koduck.dto.auth;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 用户登录请求 DTO。
 *
 * @author Koduck Team
 */
@Data
public class LoginRequest {

    /** 用户名. */
    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 50, message = "用户名长度必须在3-50之间")
    private String username;

    /** 密码. */
    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 100, message = "密码长度必须在6-100之间")
    private String password;

    /** Turnstile 验证令牌. */
    private String turnstileToken;
}
