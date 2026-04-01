package com.koduck.dto.user;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 *  DTO
 */
@Data
public class UpdateProfileRequest {

    @Size(max = 50, message = "昵称长度不能超过50")
    private String nickname;

    @Size(max = 255, message = "头像URL长度不能超过255")
    private String avatarUrl;
}
