package com.koduck.dto.profile;

import jakarta.validation.constraints.Size;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for updating profile via API.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {

    /**
     * Nickname (max 50 characters).
     */
    @Size(max = 50, message = "Nickname must not exceed 50 characters")
    private String nickname;

    /**
     * Phone number (max 20 characters).
     */
    @Size(max = 20, message = "Phone must not exceed 20 characters")
    private String phone;

    /**
     * Bio/description (max 500 characters).
     */
    @Size(max = 500, message = "Bio must not exceed 500 characters")
    private String bio;

    /**
     * Location (max 100 characters).
     */
    @Size(max = 100, message = "Location must not exceed 100 characters")
    private String location;

    /**
     * Website URL (max 200 characters).
     */
    @Size(max = 200, message = "Website must not exceed 200 characters")
    private String website;
}
