package com.koduck.dto.profile;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for user preferences.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreferencesResponse
{

    /**
     * Theme preference.
     */
    private String theme;

    /**
     * Language code.
     */
    private String language;

    /**
     * Timezone.
     */
    private String timezone;

    /**
     * Date format.
     */
    private String dateFormat;

    /**
     * Time format.
     */
    private String timeFormat;

    /**
     * Whether notifications are enabled.
     */
    private boolean notificationsEnabled;

    /**
     * Whether email notifications are enabled.
     */
    private boolean emailNotificationsEnabled;

    /**
     * Whether push notifications are enabled.
     */
    private boolean pushNotificationsEnabled;
}
