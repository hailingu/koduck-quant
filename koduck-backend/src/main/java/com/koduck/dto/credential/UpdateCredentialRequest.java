package com.koduck.dto.credential;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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
}
