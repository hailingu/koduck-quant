package com.koduck.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Data;

/**
 * 修改密码请求 DTO。
 *
 * @author Koduck Team
 */
@Data
public class ChangePasswordRequest {

    /** 旧密码. */
    @NotBlank(message = "旧密码不能为空")
    private String oldPassword;

    /** 新密码. */
    @NotBlank(message = "新密码不能为空")
    @Size(min = 6, max = 100, message = "新密码长度必须在6-100之间")
    private String newPassword;

    /** 确认密码. */
    @NotBlank(message = "确认密码不能为空")
    private String confirmPassword;
}
