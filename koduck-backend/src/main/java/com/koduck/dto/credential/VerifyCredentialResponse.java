package com.koduck.dto.credential;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 验证凭证响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerifyCredentialResponse {

    private Long credentialId;
    private boolean valid;
    private String message;
    private String details;
    private LocalDateTime verifiedAt;

    // 验证结果状态：SUCCESS, FAILED
    private String status;
}
