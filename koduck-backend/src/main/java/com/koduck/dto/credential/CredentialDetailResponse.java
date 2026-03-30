package com.koduck.dto.credential;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.koduck.util.CollectionCopyUtils;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

/**
 *  DTO（，）
 */
@Data
@NoArgsConstructor
public class CredentialDetailResponse {

    private Long id;
    private String name;
    private String type;
    private String provider;
    private String environment;
    private Boolean isActive;

    //  API Key（）
    private String apiKey;

    //  API Secret（）
    private String apiSecret;

    private Map<String, Object> additionalConfig;

    private String lastVerifiedStatus;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime lastVerifiedAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
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
        private String apiKey;
        private String apiSecret;
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
        public Builder apiKey(String apiKey) { this.apiKey = apiKey; return this; }
        public Builder apiSecret(String apiSecret) { this.apiSecret = apiSecret; return this; }
        public Builder additionalConfig(Map<String, Object> additionalConfig) { this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig); return this; }
        public Builder lastVerifiedStatus(String lastVerifiedStatus) { this.lastVerifiedStatus = lastVerifiedStatus; return this; }
        public Builder lastVerifiedAt(LocalDateTime lastVerifiedAt) { this.lastVerifiedAt = lastVerifiedAt; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

        public CredentialDetailResponse build() {
            CredentialDetailResponse response = new CredentialDetailResponse();
            response.setId(id);
            response.setName(name);
            response.setType(type);
            response.setProvider(provider);
            response.setEnvironment(environment);
            response.setIsActive(isActive);
            response.setApiKey(apiKey);
            response.setApiSecret(apiSecret);
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
