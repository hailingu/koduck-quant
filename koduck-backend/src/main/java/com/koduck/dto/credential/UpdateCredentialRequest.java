package com.koduck.dto.credential;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.util.CollectionCopyUtils;

/**
 * 更新凭证请求 DTO。
 *
 * @author GitHub Copilot
 */
@Data
@NoArgsConstructor
public class UpdateCredentialRequest {

    /** 凭证名称. */
    @NotBlank(message = "凭证名称不能为空")
    @Size(max = 100, message = "凭证名称最多 100 个字符")
    private String name;

    /** API Key. */
    private String apiKey;

    /** API Secret. */
    private String apiSecret;

    /** 环境类型（paper, live, sandbox）. */
    @Pattern(regexp = "paper|live|sandbox", message = "环境类型必须是 paper, live 或 sandbox")
    private String environment;

    /** 额外配置. */
    private Map<String, Object> additionalConfig;

    /** 是否激活. */
    private Boolean isActive;

    /**
     * 全参构造函数。
     *
     * @param nameValue 名称
     * @param apiKeyValue API Key
     * @param apiSecretValue API Secret
     * @param environmentValue 环境
     * @param additionalConfigValue 额外配置
     * @param isActiveValue 是否激活
     */
    public UpdateCredentialRequest(String nameValue, String apiKeyValue, String apiSecretValue,
                                   String environmentValue,
                                   Map<String, Object> additionalConfigValue, Boolean isActiveValue) {
        this.name = nameValue;
        this.apiKey = apiKeyValue;
        this.apiSecret = apiSecretValue;
        this.environment = environmentValue;
        this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfigValue);
        this.isActive = isActiveValue;
    }

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

        /** API Key. */
        private String apiKey;

        /** API Secret. */
        private String apiSecret;

        /** 环境类型. */
        private String environment;

        /** 额外配置. */
        private Map<String, Object> additionalConfig;

        /** 是否激活. */
        private Boolean isActive;

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
         * 构建 UpdateCredentialRequest 实例。
         *
         * @return UpdateCredentialRequest 实例
         */
        public UpdateCredentialRequest build() {
            return new UpdateCredentialRequest(name, apiKey, apiSecret, environment,
                additionalConfig, isActive);
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
