package com.koduck.dto.credential;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.util.CollectionCopyUtils;
import java.util.Map;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
public class CreateCredentialRequest {

    @NotBlank(message = "凭证名称不能为空")
    @Size(max = 100, message = "凭证名称最多 100 个字符")
    private String name;

    @NotNull(message = "凭证类型不能为空")
    @Pattern(regexp = "BROKER|DATA_SOURCE|EXCHANGE|AI_PROVIDER", message = "凭证类型必须是 BROKER, DATA_SOURCE, EXCHANGE 或 AI_PROVIDER")
    private String type;

    @NotBlank(message = "提供商不能为空")
    @Size(max = 50, message = "提供商名称最多 50 个字符")
    private String provider;

    @NotBlank(message = "API Key 不能为空")
    private String apiKey;

    private String apiSecret;

    @Pattern(regexp = "paper|live|sandbox", message = "环境类型必须是 paper, live 或 sandbox")
    private String environment;

    private Map<String, Object> additionalConfig;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private String name;
        private String type;
        private String provider;
        private String apiKey;
        private String apiSecret;
        private String environment;
        private Map<String, Object> additionalConfig;

        public Builder name(String name) { this.name = name; return this; }
        public Builder type(String type) { this.type = type; return this; }
        public Builder provider(String provider) { this.provider = provider; return this; }
        public Builder apiKey(String apiKey) { this.apiKey = apiKey; return this; }
        public Builder apiSecret(String apiSecret) { this.apiSecret = apiSecret; return this; }
        public Builder environment(String environment) { this.environment = environment; return this; }
        public Builder additionalConfig(Map<String, Object> additionalConfig) { this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig); return this; }

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

    public Map<String, Object> getAdditionalConfig() {
        return CollectionCopyUtils.copyMap(additionalConfig);
    }

    public void setAdditionalConfig(Map<String, Object> additionalConfig) {
        this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig);
    }
}
