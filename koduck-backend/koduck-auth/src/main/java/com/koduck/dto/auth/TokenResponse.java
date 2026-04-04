package com.koduck.dto.auth;

import com.koduck.security.UserPrincipal;

import lombok.Builder;
import lombok.Data;

/**
 * 令牌响应 DTO。
 *
 * @param <U> 用户类型，必须实现 UserPrincipal
 * @author Koduck Team
 */
@Data
@Builder
public class TokenResponse<U extends UserPrincipal> {

    /**
     * 访问令牌。
     */
    private String accessToken;

    /**
     * 刷新令牌。
     */
    private String refreshToken;

    /**
     * 令牌类型。
     */
    @Builder.Default
    private String tokenType = "Bearer";

    /**
     * 过期时间（秒）。
     */
    private Long expiresIn;

    /**
     * 用户信息。
     */
    private U user;
}
