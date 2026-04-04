package com.koduck.dto.credential;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 验证凭证响应 DTO。
 *
 * @author GitHub Copilot
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerifyCredentialResponse {

    /** 凭证ID. */
    private Long credentialId;

    /** 是否有效. */
    private boolean valid;

    /** 消息. */
    private String message;

    /** 详情. */
    private String details;

    /** 验证时间. */
    private LocalDateTime verifiedAt;

    /** 状态：SUCCESS, FAILED. */
    private String status;
}
