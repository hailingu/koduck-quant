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
 * 用户凭证实体，用于存储 API Key 和 Secret。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "user_credentials")
@Data
@NoArgsConstructor
public class UserCredential {

    /**
     * 主键。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 凭证名称。
     */
    @Column(nullable = false, length = 100)
    private String name;

    /**
     * 凭证类型。
     */
    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private CredentialType type;

    /**
     * 提供商名称。
     */
    @Column(nullable = false, length = 50)
    private String provider;

    /**
     * 加密的 API Key。
     */
    @Column(name = "api_key_encrypted", nullable = false, columnDefinition = "TEXT")
    private String apiKeyEncrypted;

    /**
     * 加密的 API Secret。
     */
    @Column(name = "api_secret_encrypted", columnDefinition = "TEXT")
    private String apiSecretEncrypted;

    /**
     * 环境类型。
     */
    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private Environment environment;

    /**
     * 附加配置。
     */
    @Column(name = "additional_config", columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> additionalConfig;

    /**
     * 激活标志。
     */
    @Column(name = "is_active")
    private Boolean isActive = true;

    /**
     * 最后验证时间。
     */
    @Column(name = "last_verified_at")
    private LocalDateTime lastVerifiedAt;

    /**
     * 最后验证状态。
     */
    @Column(name = "last_verified_status", length = 20)
    @Enumerated(EnumType.STRING)
    private VerificationStatus lastVerifiedStatus;

    /**
     * 创建时间。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 更新时间。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 创建新的构建器。
     *
     * @return 构建器实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * 获取附加配置副本。
     *
     * @return 附加配置副本
     */
    public Map<String, Object> getAdditionalConfig() {
        return CollectionCopyUtils.copyMap(additionalConfig);
    }

    /**
     * 使用副本设置附加配置。
     *
     * @param additionalConfig 附加配置
     */
    public void setAdditionalConfig(Map<String, Object> additionalConfig) {
        this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig);
    }

    /**
     * UserCredential 的构建器类。
     */
    public static final class Builder {

        /** 构建器 id 字段。 */
        private Long id;

        /** 构建器 userId 字段。 */
        private Long userId;

        /** 构建器 name 字段。 */
        private String name;

        /** 构建器 type 字段。 */
        private CredentialType type;

        /** 构建器 provider 字段。 */
        private String provider;

        /** 构建器 apiKeyEncrypted 字段。 */
        private String apiKeyEncrypted;

        /** 构建器 apiSecretEncrypted 字段。 */
        private String apiSecretEncrypted;

        /** 构建器 environment 字段。 */
        private Environment environment;

        /** 构建器 additionalConfig 字段。 */
        private Map<String, Object> additionalConfig;

        /** 构建器 isActive 字段。 */
        private Boolean isActive;

        /** 构建器 lastVerifiedAt 字段。 */
        private LocalDateTime lastVerifiedAt;

        /** 构建器 lastVerifiedStatus 字段。 */
        private VerificationStatus lastVerifiedStatus;

        /** 构建器 createdAt 字段。 */
        private LocalDateTime createdAt;

        /** 构建器 updatedAt 字段。 */
        private LocalDateTime updatedAt;

        /**
         * 设置 ID。
         *
         * @param id ID
         * @return 此构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置用户 ID。
         *
         * @param userId 用户 ID
         * @return 此构建器
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * 设置名称。
         *
         * @param name 名称
         * @return 此构建器
         */
        public Builder name(String name) {
            this.name = name;
            return this;
        }

        /**
         * 设置类型。
         *
         * @param type 类型
         * @return 此构建器
         */
        public Builder type(CredentialType type) {
            this.type = type;
            return this;
        }

        /**
         * 设置提供商。
         *
         * @param provider 提供商
         * @return 此构建器
         */
        public Builder provider(String provider) {
            this.provider = provider;
            return this;
        }

        /**
         * 设置加密的 API Key。
         *
         * @param apiKeyEncrypted 加密的 API Key
         * @return 此构建器
         */
        public Builder apiKeyEncrypted(String apiKeyEncrypted) {
            this.apiKeyEncrypted = apiKeyEncrypted;
            return this;
        }

        /**
         * 设置加密的 API Secret。
         *
         * @param apiSecretEncrypted 加密的 API Secret
         * @return 此构建器
         */
        public Builder apiSecretEncrypted(String apiSecretEncrypted) {
            this.apiSecretEncrypted = apiSecretEncrypted;
            return this;
        }

        /**
         * 设置环境。
         *
         * @param environment 环境
         * @return 此构建器
         */
        public Builder environment(Environment environment) {
            this.environment = environment;
            return this;
        }

        /**
         * 设置附加配置。
         *
         * @param additionalConfig 附加配置
         * @return 此构建器
         */
        public Builder additionalConfig(Map<String, Object> additionalConfig) {
            this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig);
            return this;
        }

        /**
         * 设置激活标志。
         *
         * @param isActive 激活标志
         * @return 此构建器
         */
        public Builder isActive(Boolean isActive) {
            this.isActive = isActive;
            return this;
        }

        /**
         * 设置最后验证时间。
         *
         * @param lastVerifiedAt 最后验证时间
         * @return 此构建器
         */
        public Builder lastVerifiedAt(LocalDateTime lastVerifiedAt) {
            this.lastVerifiedAt = lastVerifiedAt;
            return this;
        }

        /**
         * 设置最后验证状态。
         *
         * @param lastVerifiedStatus 最后验证状态
         * @return 此构建器
         */
        public Builder lastVerifiedStatus(VerificationStatus lastVerifiedStatus) {
            this.lastVerifiedStatus = lastVerifiedStatus;
            return this;
        }

        /**
         * 设置创建时间。
         *
         * @param createdAt 创建时间
         * @return 此构建器
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * 设置更新时间。
         *
         * @param updatedAt 更新时间
         * @return 此构建器
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * 构建 UserCredential。
         *
         * @return UserCredential
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
     * 凭证类型枚举。
     */
    public enum CredentialType {

        /**
         * 券商 API。
         */
        BROKER,

        /**
         * 数据源 API。
         */
        DATA_SOURCE,

        /**
         * 交易所 API。
         */
        EXCHANGE,

        /**
         * AI 提供商 API。
         */
        AI_PROVIDER
    }

    /**
     * 环境枚举。
     */
    public enum Environment {

        /**
         * 模拟交易。
         */
        PAPER,

        /**
         * 实盘交易。
         */
        LIVE,

        /**
         * 沙盒环境。
         */
        SANDBOX
    }

    /**
     * 验证状态枚举。
     */
    public enum VerificationStatus {

        /**
         * 验证成功。
         */
        SUCCESS,

        /**
         * 验证失败。
         */
        FAILED,

        /**
         * 验证待处理。
         */
        PENDING
    }
}
