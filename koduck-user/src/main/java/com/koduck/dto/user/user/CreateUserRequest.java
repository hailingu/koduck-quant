package com.koduck.dto.user.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 内部创建用户请求。
 *
 * <p>供 koduck-auth 注册用户时调用，用于 POST /internal/users。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateUserRequest {

    @NotBlank(message = "用户名不能为空")
    @Size(max = 50, message = "用户名长度不能超过50个字符")
    private String username;

    @NotBlank(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    @Size(max = 100, message = "邮箱长度不能超过100个字符")
    private String email;

    @NotBlank(message = "密码哈希不能为空")
    private String passwordHash;

    @Size(max = 50, message = "昵称长度不能超过50个字符")
    private String nickname;

    private String status;
}
