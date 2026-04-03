package com.koduck.service;

import com.koduck.dto.settings.LlmConfigDto;
import com.koduck.dto.settings.UpdateNotificationRequest;
import com.koduck.dto.settings.UpdateSettingsRequest;
import com.koduck.dto.settings.UserSettingsDto;

/**
 * User settings service interface.
 *
 * @author Koduck Team
 */
public interface UserSettingsService {

    /**
     * Gets user settings.
     *
     * @param userId the user ID
     * @return the user settings DTO
     */
    UserSettingsDto getSettings(Long userId);

    /**
     * Updates user settings.
     *
     * @param userId the user ID
     * @param request the update settings request
     * @return the updated user settings DTO
     */
    UserSettingsDto updateSettings(Long userId, UpdateSettingsRequest request);

    /**
     * Updates theme setting.
     *
     * @param userId the user ID
     * @param theme the theme name
     * @return the updated user settings DTO
     */
    UserSettingsDto updateTheme(Long userId, String theme);

    /**
     * Updates notification settings.
     *
     * @param userId the user ID
     * @param request the update notification request
     * @return the updated user settings DTO
     */
    UserSettingsDto updateNotification(Long userId, UpdateNotificationRequest request);

    /**
     * Gets effective LLM configuration.
     *
     * @param userId the user ID
     * @param provider the LLM provider name
     * @return the effective LLM configuration DTO
     */
    LlmConfigDto getEffectiveLlmConfig(Long userId, String provider);
}
