package com.koduck.dto.credential;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.koduck.common.constants.DateTimePatternConstants;
import com.koduck.util.CollectionCopyUtils;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 *  DTO（）
 */
@Data
@NoArgsConstructor
public class CredentialResponse {

    private Long id;
    private String name;
    private String type;
    private String provider;
    private String environment;
    private Boolean isActive;

    //  API Key（ PK***XXXX）
    private String apiKeyMasked;

    //  API Secret（ ***）
    private String apiSecretMasked;

    private Map<String, Object> additionalConfig;

    private String lastVerifiedStatus;

    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime lastVerifiedAt;

    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;

    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime updatedAt;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long id;
        private String name;
        private String type;
        private String provider;
        private String environment;
        private Boolean isActive;
        private String apiKeyMasked;
        private String apiSecretMasked;
        private Map<String, Object> additionalConfig;
        private String lastVerifiedStatus;
        private LocalDateTime lastVerifiedAt;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder type(String type) { this.type = type; return this; }
        public Builder provider(String provider) { this.provider = provider; return this; }
        public Builder environment(String environment) { this.environment = environment; return this; }
        public Builder isActive(Boolean isActive) { this.isActive = isActive; return this; }
        public Builder apiKeyMasked(String apiKeyMasked) { this.apiKeyMasked = apiKeyMasked; return this; }
        public Builder apiSecretMasked(String apiSecretMasked) { this.apiSecretMasked = apiSecretMasked; return this; }
        public Builder additionalConfig(Map<String, Object> additionalConfig) { this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig); return this; }
        public Builder lastVerifiedStatus(String lastVerifiedStatus) { this.lastVerifiedStatus = lastVerifiedStatus; return this; }
        public Builder lastVerifiedAt(LocalDateTime lastVerifiedAt) { this.lastVerifiedAt = lastVerifiedAt; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

        public CredentialResponse build() {
            CredentialResponse response = new CredentialResponse();
            response.setId(id);
            response.setName(name);
            response.setType(type);
            response.setProvider(provider);
            response.setEnvironment(environment);
            response.setIsActive(isActive);
            response.setApiKeyMasked(apiKeyMasked);
            response.setApiSecretMasked(apiSecretMasked);
            response.setAdditionalConfig(additionalConfig);
            response.setLastVerifiedStatus(lastVerifiedStatus);
            response.setLastVerifiedAt(lastVerifiedAt);
            response.setCreatedAt(createdAt);
            response.setUpdatedAt(updatedAt);
            return response;
        }
    }

    public Map<String, Object> getAdditionalConfig() {
        return CollectionCopyUtils.copyMap(additionalConfig);
    }

    public void setAdditionalConfig(Map<String, Object> additionalConfig) {
        this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig);
    }
}
