package com.koduck.service;

import com.koduck.dto.settings.LlmConfigDto;
import com.koduck.dto.settings.UpdateNotificationRequest;
import com.koduck.dto.settings.UpdateSettingsRequest;
import com.koduck.dto.settings.UserSettingsDto;

/**
 * 用户设置服务接口。
 *
 * @author Koduck Team
 */
public interface UserSettingsService {

    /**
     * 获取用户设置。
     *
     * @param userId 用户ID
     * @return 用户设置DTO
     */
    UserSettingsDto getSettings(Long userId);

    /**
     * 更新用户设置。
     *
     * @param userId  用户ID
     * @param request 更新设置请求
     * @return 更新后的用户设置DTO
     */
    UserSettingsDto updateSettings(Long userId, UpdateSettingsRequest request);

    /**
     * 更新主题设置。
     *
     * @param userId 用户ID
     * @param theme  主题名称
     * @return 更新后的用户设置DTO
     */
    UserSettingsDto updateTheme(Long userId, String theme);

    /**
     * 更新通知设置。
     *
     * @param userId  用户ID
     * @param request 更新通知请求
     * @return 更新后的用户设置DTO
     */
    UserSettingsDto updateNotification(Long userId, UpdateNotificationRequest request);

    /**
     * 获取有效的LLM配置。
     *
     * @param userId   用户ID
     * @param provider LLM提供商名称
     * @return 有效的LLM配置DTO
     */
    LlmConfigDto getEffectiveLlmConfig(Long userId, String provider);
}
