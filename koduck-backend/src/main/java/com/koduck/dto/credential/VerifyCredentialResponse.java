package com.koduck.dto.credential;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 *  DTO
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

    // ：SUCCESS, FAILED
    private String status;
}
