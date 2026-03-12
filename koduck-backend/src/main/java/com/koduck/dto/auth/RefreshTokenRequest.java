package com.koduck.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 *  Token  DTO
 */
@Data
public class RefreshTokenRequest {

    @NotBlank(message = "刷新令牌不能为空")
    private String refreshToken;
}
