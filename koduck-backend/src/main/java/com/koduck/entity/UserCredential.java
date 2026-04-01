package com.koduck.entity;

import com.koduck.util.CollectionCopyUtils;
import jakarta.persistence.*;
import lombok.Data;
import lombok.Setter;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 *  -  API Key  Secret
 */
@Entity
@Table(name = "user_credentials")
@Data
@NoArgsConstructor
public class UserCredential {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private CredentialType type;

    @Column(nullable = false, length = 50)
    private String provider;

    @Column(name = "api_key_encrypted", nullable = false, columnDefinition = "TEXT")
    private String apiKeyEncrypted;

    @Column(name = "api_secret_encrypted", columnDefinition = "TEXT")
    private String apiSecretEncrypted;

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private Environment environment;

    @Column(name = "additional_config", columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> additionalConfig;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "last_verified_at")
    private LocalDateTime lastVerifiedAt;

    @Column(name = "last_verified_status", length = 20)
    @Enumerated(EnumType.STRING)
    private VerificationStatus lastVerifiedStatus;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public static Builder builder() {
        return new Builder();
    }

    public Map<String, Object> getAdditionalConfig() {
        return CollectionCopyUtils.copyMap(additionalConfig);
    }

    public void setAdditionalConfig(Map<String, Object> additionalConfig) {
        this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig);
    }

    public static final class Builder {

        private Long id;
        private Long userId;
        private String name;
        private CredentialType type;
        private String provider;
        private String apiKeyEncrypted;
        private String apiSecretEncrypted;
        private Environment environment;
        private Map<String, Object> additionalConfig;
        private Boolean isActive;
        private LocalDateTime lastVerifiedAt;
        private VerificationStatus lastVerifiedStatus;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder type(CredentialType type) { this.type = type; return this; }
        public Builder provider(String provider) { this.provider = provider; return this; }
        public Builder apiKeyEncrypted(String apiKeyEncrypted) { this.apiKeyEncrypted = apiKeyEncrypted; return this; }
        public Builder apiSecretEncrypted(String apiSecretEncrypted) { this.apiSecretEncrypted = apiSecretEncrypted; return this; }
        public Builder environment(Environment environment) { this.environment = environment; return this; }
        public Builder additionalConfig(Map<String, Object> additionalConfig) { this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig); return this; }
        public Builder isActive(Boolean isActive) { this.isActive = isActive; return this; }
        public Builder lastVerifiedAt(LocalDateTime lastVerifiedAt) { this.lastVerifiedAt = lastVerifiedAt; return this; }
        public Builder lastVerifiedStatus(VerificationStatus lastVerifiedStatus) { this.lastVerifiedStatus = lastVerifiedStatus; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

        public UserCredential build() {
            UserCredential credential = new UserCredential();
            credential.id = id;
            credential.setUserId(userId);
            credential.setName(name);
            credential.setType(type);
            credential.setProvider(provider);
            credential.setApiKeyEncrypted(apiKeyEncrypted);
            credential.setApiSecretEncrypted(apiSecretEncrypted);
            credential.setEnvironment(environment);
            credential.setAdditionalConfig(additionalConfig);
            if (isActive != null) {
                credential.setIsActive(isActive);
            }
            credential.setLastVerifiedAt(lastVerifiedAt);
            credential.setLastVerifiedStatus(lastVerifiedStatus);
            credential.createdAt = createdAt;
            credential.setUpdatedAt(updatedAt);
            return credential;
        }
    }

    /**
     * 
     */
    public enum CredentialType {
        BROKER,      //  API
        DATA_SOURCE, //  API
        EXCHANGE,    //  API
        AI_PROVIDER  // AI  API
    }

    /**
     * 
     */
    public enum Environment {
        PAPER,   // /
        LIVE,    // 
        SANDBOX  // 
    }

    /**
     * 
     */
    public enum VerificationStatus {
        SUCCESS, // 
        FAILED,  // 
        PENDING  // 
    }
}
