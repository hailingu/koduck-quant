package com.koduck.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 安全配置响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityConfigResponse {

    private Boolean turnstileEnabled;
    private String turnstileSiteKey;
    private Boolean registrationEnabled;
    private Boolean oauthGoogleEnabled;
    private Boolean oauthGithubEnabled;
}
