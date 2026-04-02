package com.koduck.dto.credential;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;


/**
 * 更新凭证请求 DTO。
 *
 * @author Koduck Team
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

    /** 沙盒模式 API Key. */
    private String sandboxApiKey;

    /** 沙盒模式 API Secret. */
    private String sandboxApiSecret;

    /** 额外配置（JSON格式）. */
    @Pattern(regexp = "^$|^\\{.*\\}$", message = "额外配置必须是JSON格式")
    private String extraConfig;

    /** 环境（PRODUCTION/SANDBOX）. */
    private String environment;

    /** 额外配置（Map格式）. */
    private Map<String, Object> additionalConfig;

    /** 是否启用. */
    private Boolean isActive;
}
