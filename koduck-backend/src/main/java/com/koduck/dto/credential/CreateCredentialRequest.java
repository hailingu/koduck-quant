package com.koduck.dto.credential;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * 创建凭证请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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
}
