package com.koduck.dto.profile;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for avatar upload.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvatarResponse
{

    /**
     * URL of the uploaded avatar.
     */
    private String avatarUrl;

    /**
     * Response message.
     */
    private String message;
}
