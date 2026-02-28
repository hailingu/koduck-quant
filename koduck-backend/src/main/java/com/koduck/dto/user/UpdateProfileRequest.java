package com.koduck.dto.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 更新个人资料请求 DTO
 */
@Data
public class UpdateProfileRequest {

    @Size(max = 50, message = "昵称长度不能超过50")
    private String nickname;

    @Size(max = 255, message = "头像URL长度不能超过255")
    private String avatarUrl;
}
