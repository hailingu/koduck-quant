package com.koduck.service;
import com.koduck.dto.settings.UpdateNotificationRequest;
import com.koduck.dto.settings.UpdateSettingsRequest;
import com.koduck.dto.settings.UserSettingsDto;

/**
 * 用户设置服务接口
 */
public interface UserSettingsService {

    /**
     * 获取用户设置
     */
    UserSettingsDto getSettings(Long userId);

    /**
     * 更新用户设置
     */
    UserSettingsDto updateSettings(Long userId, UpdateSettingsRequest request);

    /**
     * 更新主题设置
     */
    UserSettingsDto updateTheme(Long userId, String theme);

    /**
     * 更新通知设置
     */
    UserSettingsDto updateNotification(Long userId, UpdateNotificationRequest request);

    /**
     * 获取有效的 LLM 配置
     */
    UserSettingsDto.LlmConfigDto getEffectiveLlmConfig(Long userId, String provider);
}
