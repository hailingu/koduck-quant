package com.koduck.profile.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for avatar upload.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvatarResponse {
    
    private String avatarUrl;
    private String message;
}
