package com.koduck.profile.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for updating user profile.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileDTO {
    
    private String nickname;
    private String phone;
    private String bio;
    private String location;
    private String website;
}
