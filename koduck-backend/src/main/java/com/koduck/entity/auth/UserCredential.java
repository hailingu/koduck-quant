package com.koduck.entity.auth;

import java.time.LocalDateTime;
import java.util.Map;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import com.koduck.util.CollectionCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * User credential entity for API Key and Secret.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "user_credentials")
@Data
@NoArgsConstructor
public class UserCredential {

    /**
     * Primary key.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * User ID.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Credential name.
     */
    @Column(nullable = false, length = 100)
    private String name;

    /**
     * Credential type.
     */
    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private CredentialType type;

    /**
     * Provider name.
     */
    @Column(nullable = false, length = 50)
    private String provider;

    /**
     * Encrypted API key.
     */
    @Column(name = "api_key_encrypted", nullable = false, columnDefinition = "TEXT")
    private String apiKeyEncrypted;

    /**
     * Encrypted API secret.
     */
    @Column(name = "api_secret_encrypted", columnDefinition = "TEXT")
    private String apiSecretEncrypted;

    /**
     * Environment type.
     */
    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private Environment environment;

    /**
     * Additional configuration.
     */
    @Column(name = "additional_config", columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> additionalConfig;

    /**
     * Active flag.
     */
    @Column(name = "is_active")
    private Boolean isActive = true;

    /**
     * Last verified at.
     */
    @Column(name = "last_verified_at")
    private LocalDateTime lastVerifiedAt;

    /**
     * Last verified status.
     */
    @Column(name = "last_verified_status", length = 20)
    @Enumerated(EnumType.STRING)
    private VerificationStatus lastVerifiedStatus;

    /**
     * Created at.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Updated at.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Creates a new builder.
     *
     * @return Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Gets additional config copy.
     *
     * @return additional config copy
     */
    public Map<String, Object> getAdditionalConfig() {
        return CollectionCopyUtils.copyMap(additionalConfig);
    }

    /**
     * Sets additional config with copy.
     *
     * @param additionalConfig the additional config
     */
    public void setAdditionalConfig(Map<String, Object> additionalConfig) {
        this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig);
    }

    /**
     * Builder class for UserCredential.
     */
    public static final class Builder {

        /** Builder field for id. */
        private Long id;

        /** Builder field for userId. */
        private Long userId;

        /** Builder field for name. */
        private String name;

        /** Builder field for type. */
        private CredentialType type;

        /** Builder field for provider. */
        private String provider;

        /** Builder field for apiKeyEncrypted. */
        private String apiKeyEncrypted;

        /** Builder field for apiSecretEncrypted. */
        private String apiSecretEncrypted;

        /** Builder field for environment. */
        private Environment environment;

        /** Builder field for additionalConfig. */
        private Map<String, Object> additionalConfig;

        /** Builder field for isActive. */
        private Boolean isActive;

        /** Builder field for lastVerifiedAt. */
        private LocalDateTime lastVerifiedAt;

        /** Builder field for lastVerifiedStatus. */
        private VerificationStatus lastVerifiedStatus;

        /** Builder field for createdAt. */
        private LocalDateTime createdAt;

        /** Builder field for updatedAt. */
        private LocalDateTime updatedAt;

        /**
         * Sets the ID.
         *
         * @param id the ID
         * @return this builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the user ID.
         *
         * @param userId the user ID
         * @return this builder
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * Sets the name.
         *
         * @param name the name
         * @return this builder
         */
        public Builder name(String name) {
            this.name = name;
            return this;
        }

        /**
         * Sets the type.
         *
         * @param type the type
         * @return this builder
         */
        public Builder type(CredentialType type) {
            this.type = type;
            return this;
        }

        /**
         * Sets the provider.
         *
         * @param provider the provider
         * @return this builder
         */
        public Builder provider(String provider) {
            this.provider = provider;
            return this;
        }

        /**
         * Sets the API key encrypted.
         *
         * @param apiKeyEncrypted the API key encrypted
         * @return this builder
         */
        public Builder apiKeyEncrypted(String apiKeyEncrypted) {
            this.apiKeyEncrypted = apiKeyEncrypted;
            return this;
        }

        /**
         * Sets the API secret encrypted.
         *
         * @param apiSecretEncrypted the API secret encrypted
         * @return this builder
         */
        public Builder apiSecretEncrypted(String apiSecretEncrypted) {
            this.apiSecretEncrypted = apiSecretEncrypted;
            return this;
        }

        /**
         * Sets the environment.
         *
         * @param environment the environment
         * @return this builder
         */
        public Builder environment(Environment environment) {
            this.environment = environment;
            return this;
        }

        /**
         * Sets the additional config.
         *
         * @param additionalConfig the additional config
         * @return this builder
         */
        public Builder additionalConfig(Map<String, Object> additionalConfig) {
            this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig);
            return this;
        }

        /**
         * Sets the active flag.
         *
         * @param isActive the active flag
         * @return this builder
         */
        public Builder isActive(Boolean isActive) {
            this.isActive = isActive;
            return this;
        }

        /**
         * Sets the last verified at.
         *
         * @param lastVerifiedAt the last verified at
         * @return this builder
         */
        public Builder lastVerifiedAt(LocalDateTime lastVerifiedAt) {
            this.lastVerifiedAt = lastVerifiedAt;
            return this;
        }

        /**
         * Sets the last verified status.
         *
         * @param lastVerifiedStatus the last verified status
         * @return this builder
         */
        public Builder lastVerifiedStatus(VerificationStatus lastVerifiedStatus) {
            this.lastVerifiedStatus = lastVerifiedStatus;
            return this;
        }

        /**
         * Sets the created at.
         *
         * @param createdAt the created at
         * @return this builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Sets the updated at.
         *
         * @param updatedAt the updated at
         * @return this builder
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * Builds the UserCredential.
         *
         * @return the UserCredential
         */
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
     * Credential type enum.
     */
    public enum CredentialType {

        /**
         * Broker API.
         */
        BROKER,

        /**
         * Data source API.
         */
        DATA_SOURCE,

        /**
         * Exchange API.
         */
        EXCHANGE,

        /**
         * AI provider API.
         */
        AI_PROVIDER
    }

    /**
     * Environment enum.
     */
    public enum Environment {

        /**
         * Paper trading.
         */
        PAPER,

        /**
         * Live trading.
         */
        LIVE,

        /**
         * Sandbox environment.
         */
        SANDBOX
    }

    /**
     * Verification status enum.
     */
    public enum VerificationStatus {

        /**
         * Verification success.
         */
        SUCCESS,

        /**
         * Verification failed.
         */
        FAILED,

        /**
         * Verification pending.
         */
        PENDING
    }
}
