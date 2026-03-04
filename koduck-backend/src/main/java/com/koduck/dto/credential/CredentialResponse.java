package com.koduck.dto.credential;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 凭证响应 DTO（脱敏）
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CredentialResponse {

    private Long id;
    private String name;
    private String type;
    private String provider;
    private String environment;
    private Boolean isActive;

    // 脱敏后的 API Key（如 PK***XXXX）
    private String apiKeyMasked;

    // 脱敏后的 API Secret（如 ***）
    private String apiSecretMasked;

    private Map<String, Object> additionalConfig;

    private String lastVerifiedStatus;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime lastVerifiedAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
}
