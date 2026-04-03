package com.koduck.dto.profile;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * User profile data transfer object.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileDTO {

    /**
     * User ID.
     */
    private Long id;

    /**
     * Username.
     */
    private String username;

    /**
     * Email address.
     */
    private String email;

    /**
     * Nickname.
     */
    private String nickname;

    /**
     * Avatar URL.
     */
    private String avatarUrl;

    /**
     * Phone number.
     */
    private String phone;

    /**
     * Bio/description.
     */
    private String bio;

    /**
     * Location.
     */
    private String location;

    /**
     * Website URL.
     */
    private String website;

    /**
     * Account creation time.
     */
    private LocalDateTime createdAt;

    /**
     * Last update time.
     */
    private LocalDateTime updatedAt;
}
