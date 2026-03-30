package com.koduck.dto.credential;

import jakarta.validation.constraints.NotBlank;
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
public class UpdateCredentialRequest {

    @NotBlank(message = "凭证名称不能为空")
    @Size(max = 100, message = "凭证名称最多 100 个字符")
    private String name;

    private String apiKey;

    private String apiSecret;

    @Pattern(regexp = "paper|live|sandbox", message = "环境类型必须是 paper, live 或 sandbox")
    private String environment;

    private Map<String, Object> additionalConfig;

    private Boolean isActive;

    public UpdateCredentialRequest(String name, String apiKey, String apiSecret, String environment,
                                   Map<String, Object> additionalConfig, Boolean isActive) {
        this.name = name;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.environment = environment;
        this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig);
        this.isActive = isActive;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private String name;
        private String apiKey;
        private String apiSecret;
        private String environment;
        private Map<String, Object> additionalConfig;
        private Boolean isActive;

        public Builder name(String name) { this.name = name; return this; }
        public Builder apiKey(String apiKey) { this.apiKey = apiKey; return this; }
        public Builder apiSecret(String apiSecret) { this.apiSecret = apiSecret; return this; }
        public Builder environment(String environment) { this.environment = environment; return this; }
        public Builder additionalConfig(Map<String, Object> additionalConfig) { this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig); return this; }
        public Builder isActive(Boolean isActive) { this.isActive = isActive; return this; }

        public UpdateCredentialRequest build() {
            return new UpdateCredentialRequest(name, apiKey, apiSecret, environment, additionalConfig, isActive);
        }
    }

    public Map<String, Object> getAdditionalConfig() {
        return CollectionCopyUtils.copyMap(additionalConfig);
    }

    public void setAdditionalConfig(Map<String, Object> additionalConfig) {
        this.additionalConfig = CollectionCopyUtils.copyMap(additionalConfig);
    }
}
