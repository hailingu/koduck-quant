package com.koduck.dto.profile;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request DTO for updating user preferences.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePreferencesRequest {
    
    @Pattern(regexp = "light|dark|auto", message = "Theme must be light, dark, or auto")
    private String theme;
    
    @Size(min = 2, max = 10, message = "Language code must be 2-10 characters")
    private String language;
    
    private String timezone;
    
    @Pattern(regexp = "yyyy-MM-dd|MM/dd/yyyy|dd/MM/yyyy", message = "Invalid date format")
    private String dateFormat;
    
    @Pattern(regexp = "12h|24h", message = "Time format must be 12h or 24h")
    private String timeFormat;
    
    private Boolean notificationsEnabled;
    
    private Boolean emailNotificationsEnabled;
    
    private Boolean pushNotificationsEnabled;
}
