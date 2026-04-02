package com.koduck.dto.credential;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.util.CollectionCopyUtils;

/**
 * 创建凭证请求 DTO。
 *
 * @author GitHub Copilot
 */
@Data
@NoArgsConstructor
public class CreateCredentialRequest {

    /** 凭证名称. */
    @NotBlank(message = "凭证名称不能为空")
    @Size(max = 100, message = "凭证名称最多 100 个字符")
    private String name;

    /**
     * 凭证类型。
     * 可选值：BROKER, DATA_SOURCE, EXCHANGE, AI_PROVIDER
     */
    @NotNull(message = "凭证类型不能为空")
    @Pattern(regexp = "BROKER|DATA_SOURCE|EXCHANGE|AI_PROVIDER",
        message = "凭证类型必须是 BROKER, DATA_SOURCE, EXCHANGE 或 AI_PROVIDER")
    private String type;

    /** 提供商. */
    @NotBlank(message = "提供商不能为空")
    @Size(max = 50, message = "提供商名称最多 50 个字符")
    private String provider;

    /** API Key. */
    @NotBlank(message = "API Key 不能为空")
    private String apiKey;

    /** API Secret. */
    private String apiSecret;

    /** 环境类型（paper, live, sandbox）. */
    @Pattern(regexp = "paper|live|sandbox",
        message = "环境类型必须是 paper, live 或 sandbox")
    private String environment;

    /** 额外配置. */
    private Map<String, Object> additionalConfig;

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

        /** 凭证名称. */
        private String name;

        /** 凭证类型. */
        private String type;

        /** 提供商. */
        private String provider;

        /** API Key. */
        private String apiKey;

        /** API Secret. */
        private String apiSecret;

        /** 环境类型. */
        private String environment;

        /** 额外配置. */
        private Map<String, Object> additionalConfig;

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
         * 构建 CreateCredentialRequest 实例。
         *
         * @return CreateCredentialRequest 实例
         */
        public CreateCredentialRequest build() {
            CreateCredentialRequest request = new CreateCredentialRequest();
            request.setName(name);
            request.setType(type);
            request.setProvider(provider);
            request.setApiKey(apiKey);
            request.setApiSecret(apiSecret);
            request.setEnvironment(environment);
            request.setAdditionalConfig(additionalConfig);
            return request;
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
