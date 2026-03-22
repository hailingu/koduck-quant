package com.koduck.profile.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.Size;

/**
 * Request DTO for updating profile via API.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {
    
    @Size(max = 50, message = "Nickname must not exceed 50 characters")
    private String nickname;
    
    @Size(max = 20, message = "Phone must not exceed 20 characters")
    private String phone;
    
    @Size(max = 500, message = "Bio must not exceed 500 characters")
    private String bio;
    
    @Size(max = 100, message = "Location must not exceed 100 characters")
    private String location;
    
    @Size(max = 200, message = "Website must not exceed 200 characters")
    private String website;
}
