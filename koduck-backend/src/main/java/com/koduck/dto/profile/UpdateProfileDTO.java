package com.koduck.dto.profile;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for updating user profile.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileDTO {

    /**
     * User's nickname.
     */
    private String nickname;

    /**
     * User's phone number.
     */
    private String phone;

    /**
     * User's bio/description.
     */
    private String bio;

    /**
     * User's location.
     */
    private String location;

    /**
     * User's website URL.
     */
    private String website;
}
