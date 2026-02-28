package com.koduck.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 刷新 Token 请求 DTO
 */
@Data
public class RefreshTokenRequest {

    @NotBlank(message = "刷新令牌不能为空")
    private String refreshToken;
}
