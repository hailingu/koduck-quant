package com.koduck.profile.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * User profile data transfer object.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileDTO {
    
    private Long id;
    private String username;
    private String email;
    private String nickname;
    private String avatarUrl;
    private String phone;
    private String bio;
    private String location;
    private String website;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
