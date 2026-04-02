package com.koduck.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 安全配置响应 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityConfigResponse {

    /** 是否启用 Turnstile 验证. */
    private Boolean turnstileEnabled;

    /** Turnstile 站点密钥. */
    private String turnstileSiteKey;

    /** 是否启用注册功能. */
    private Boolean registrationEnabled;

    /** 是否启用 Google OAuth. */
    private Boolean oauthGoogleEnabled;

    /** 是否启用 GitHub OAuth. */
    private Boolean oauthGithubEnabled;
}
