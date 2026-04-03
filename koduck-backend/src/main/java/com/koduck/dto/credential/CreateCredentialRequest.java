package com.koduck.dto.credential;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import lombok.Data;
import lombok.NoArgsConstructor;


/**
 * 创建凭证请求 DTO。
 *
 * @author Koduck Team
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
     * 可选值：IB、老虎证券、富途等
     */
    @NotBlank(message = "凭证类型不能为空")
    @Pattern(regexp = "IB|TIGER|FUTU|LONGPORT|", message = "不支持的凭证类型")
    private String type;

    /** API Key. */
    @NotBlank(message = "API Key 不能为空")
    private String apiKey;

    /** API Secret. */
    @NotBlank(message = "API Secret 不能为空")
    private String apiSecret;

    /** 沙盒模式 API Key. */
    private String sandboxApiKey;

    /** 沙盒模式 API Secret. */
    private String sandboxApiSecret;

    /** 额外配置（JSON格式）. */
    @Pattern(regexp = "^$|^\\{.*\\}$", message = "额外配置必须是JSON格式")
    private String extraConfig;

    /** 是否启用. */
    @NotNull(message = "是否启用不能为空")
    private Boolean enabled;

    /** 提供商. */
    private String provider;

    /** 环境（PRODUCTION/SANDBOX）. */
    private String environment;

    /** 额外配置（Map格式）. */
    private Map<String, Object> additionalConfig;
}
