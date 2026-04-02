package com.koduck.dto.profile;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for profile endpoints.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProfileResponse
{

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
     * Account creation time.
     */
    private LocalDateTime createdAt;

    /**
     * Last update time.
     */
    private LocalDateTime updatedAt;
}
