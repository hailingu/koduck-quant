package com.koduck.dto.profile;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for user preferences.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreferencesResponse {
    
    private String theme;
    private String language;
    private String timezone;
    private String dateFormat;
    private String timeFormat;
    private boolean notificationsEnabled;
    private boolean emailNotificationsEnabled;
    private boolean pushNotificationsEnabled;
}
