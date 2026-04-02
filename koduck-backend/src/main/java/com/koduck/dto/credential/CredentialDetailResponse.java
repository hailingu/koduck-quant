package com.koduck.dto.credential;

import java.time.LocalDateTime;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonFormat;

import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.common.constants.DateTimePatternConstants;
import com.koduck.util.CollectionCopyUtils;

/**
 * 凭证详情响应 DTO。
 *
 * @author GitHub Copilot
 */
@Data
@NoArgsConstructor
public class CredentialDetailResponse {

    /** 凭证ID. */
    private Long id;

    /** 凭证名称. */
    private String name;

    /** 凭证类型. */
    private String type;

    /** 提供商. */
    private String provider;

    /** 环境类型. */
    private String environment;

    /** 是否激活. */
    private Boolean isActive;

    /** API Key（明文，仅限创建时返回）. */
    private String apiKey;

    /** API Secret（明文，仅限创建时返回）. */
    private String apiSecret;

    /** 额外配置. */
    private Map<String, Object> additionalConfig;

    /** 最后验证状态. */
    private String lastVerifiedStatus;

    /** 最后验证时间. */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime lastVerifiedAt;

    /** 创建时间. */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime createdAt;

    /** 更新时间. */
    @JsonFormat(pattern = DateTimePatternConstants.STANDARD_DATE_TIME_PATTERN)
    private LocalDateTime updatedAt;

    /**
     * 创建 Builder 实例。
     *
     * @return Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder 类。
     */
    public static final class Builder {

        /** 凭证ID. */
        private Long id;

        /** 凭证名称. */
        private String name;

        /** 凭证类型. */
        private String type;

        /** 提供商. */
        private String provider;

        /** 环境类型. */
        private String environment;

        /** 是否激活. */
        private Boolean isActive;

        /** API Key. */
        private String apiKey;

        /** API Secret. */
        private String apiSecret;

        /** 额外配置. */
        private Map<String, Object> additionalConfig;

        /** 最后验证状态. */
        private String lastVerifiedStatus;

        /** 最后验证时间. */
        private LocalDateTime lastVerifiedAt;

        /** 创建时间. */
        private LocalDateTime createdAt;

        /** 更新时间. */
        private LocalDateTime updatedAt;

        /**
         * 设置ID。
         *
         * @param idValue ID
         * @return Builder
         */
        public Builder id(Long idValue) {
            this.id = idValue;
            return this;
        }

        /**
         * 设置名称。
         *
         * @param nameValue 名称
         * @return Builder
         */
        public Builder name(String nameValue) {
            this.name = nameValue;
            return this;
        }

        /**
         * 设置类型。
         *
         * @param typeValue 类型
         * @return Builder
         */
        public Builder type(String typeValue) {
            this.type = typeValue;
            return this;
        }

        /**
         * 设置提供商。
         *
         * @param providerValue 提供商
         * @return Builder
         */
        public Builder provider(String providerValue) {
            this.provider = providerValue;
            return this;
        }

        /**
         * 设置环境。
         *
         * @param environmentValue 环境
         * @return Builder
         */
        public Builder environment(String environmentValue) {
            this.environment = environmentValue;
            return this;
        }

        /**
         * 设置是否激活。
         *
         * @param isActiveValue 是否激活
         * @return Builder
         */
        public Builder isActive(Boolean isActiveValue) {
            this.isActive = isActiveValue;
            return this;
        }

        /**
         * 设置API Key。
         *
         * @param apiKeyValue API Key
         * @return Builder
         */
        public Builder apiKey(String apiKeyValue) {
            this.apiKey = apiKeyValue;
            return this;
        }

        /**
         * 设置API Secret。
         *
         * @param apiSecretValue API Secret
         * @return Builder
         */
        public Builder apiSecret(String apiSecretValue) {
            this.apiSecret = apiSecretValue;
            return this;
        }

        /**
         * 设置额外配置。
         *
         * @param additionalConfigValue 额外配置
         * @return Builder
         */
        public Builder additionalConfig(Map<String, Object> additionalConfigValue) {
            this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfigValue);
            return this;
        }

        /**
         * 设置最后验证状态。
         *
         * @param lastVerifiedStatusValue 最后验证状态
         * @return Builder
         */
        public Builder lastVerifiedStatus(String lastVerifiedStatusValue) {
            this.lastVerifiedStatus = lastVerifiedStatusValue;
            return this;
        }

        /**
         * 设置最后验证时间。
         *
         * @param lastVerifiedAtValue 最后验证时间
         * @return Builder
         */
        public Builder lastVerifiedAt(LocalDateTime lastVerifiedAtValue) {
            this.lastVerifiedAt = lastVerifiedAtValue;
            return this;
        }

        /**
         * 设置创建时间。
         *
         * @param createdAtValue 创建时间
         * @return Builder
         */
        public Builder createdAt(LocalDateTime createdAtValue) {
            this.createdAt = createdAtValue;
            return this;
        }

        /**
         * 设置更新时间。
         *
         * @param updatedAtValue 更新时间
         * @return Builder
         */
        public Builder updatedAt(LocalDateTime updatedAtValue) {
            this.updatedAt = updatedAtValue;
            return this;
        }

        /**
         * 构建 CredentialDetailResponse 实例。
         *
         * @return CredentialDetailResponse 实例
         */
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

    /**
     * 获取额外配置（深拷贝）。
     *
     * @return 额外配置
     */
    public Map<String, Object> getAdditionalConfig() {
        return CollectionCopyUtils.copyMap(additionalConfig);
    }

    /**
     * 设置额外配置（深拷贝）。
     *
     * @param additionalConfigValue 额外配置
     */
    public void setAdditionalConfig(Map<String, Object> additionalConfigValue) {
        this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfigValue);
    }
}
