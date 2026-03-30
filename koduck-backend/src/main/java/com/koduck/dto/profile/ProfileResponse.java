package com.koduck.dto.profile;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Response DTO for profile endpoints.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileResponse {
    
    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String avatarUrl;
    private String phone;
    private String bio;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
