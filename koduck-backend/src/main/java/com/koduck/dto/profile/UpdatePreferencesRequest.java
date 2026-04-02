package com.koduck.dto.profile;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for updating user preferences.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePreferencesRequest
{

    /**
     * Theme preference: light, dark, or auto.
     */
    @Pattern(regexp = "light|dark|auto", message = "Theme must be light, dark, or auto")
    private String theme;

    /**
     * Language code (2-10 characters).
     */
    @Size(min = 2, max = 10, message = "Language code must be 2-10 characters")
    private String language;

    /**
     * User's timezone.
     */
    private String timezone;

    /**
     * Date format preference.
     */
    @Pattern(regexp = "yyyy-MM-dd|MM/dd/yyyy|dd/MM/yyyy", message = "Invalid date format")
    private String dateFormat;

    /**
     * Time format preference: 12h or 24h.
     */
    @Pattern(regexp = "12h|24h", message = "Time format must be 12h or 24h")
    private String timeFormat;

    /**
     * Whether notifications are enabled.
     */
    private Boolean notificationsEnabled;

    /**
     * Whether email notifications are enabled.
     */
    private Boolean emailNotificationsEnabled;

    /**
     * Whether push notifications are enabled.
     */
    private Boolean pushNotificationsEnabled;
}
