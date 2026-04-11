package com.koduck.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Token 自省响应。
 *
 * <p>与 koduck-auth {@code POST /internal/tokens/validate} 返回结构对齐。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenIntrospectionResponse {

    @JsonProperty("valid")
    private boolean valid;

    @JsonProperty("user_id")
    private Long userId;

    @JsonProperty("username")
    private String username;

    @JsonProperty("tenant_id")
    private String tenantId;

    @JsonProperty("roles")
    private List<String> roles;

    @JsonProperty("expires_at")
    private Instant expiresAt;

    @JsonProperty("error_message")
    private String errorMessage;
}
