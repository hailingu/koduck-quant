package com.koduck.service.impl;

import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.koduck.dto.settings.DisplayConfigDto;
import com.koduck.dto.settings.LlmConfigDto;
import com.koduck.dto.settings.NotificationConfigDto;
import com.koduck.dto.settings.QuickLinkDto;
import com.koduck.dto.settings.TradingConfigDto;
import com.koduck.dto.settings.UpdateNotificationRequest;
import com.koduck.dto.settings.UpdateSettingsRequest;
import com.koduck.dto.settings.UserSettingsDto;
import com.koduck.entity.UserSettings;
import com.koduck.mapper.UserSettingsMapper;
import com.koduck.repository.UserSettingsRepository;
import com.koduck.service.UserSettingsService;
import com.koduck.common.constants.LlmConstants;
import com.koduck.service.support.UserSettingsLlmConfigSupport;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 用户设置服务实现类。
 *
 * @author GitHub Copilot
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserSettingsServiceImpl implements UserSettingsService {

    private static final String PROVIDER_MINIMAX = LlmConstants.PROVIDER_MINIMAX;

    private final UserSettingsRepository settingsRepository;

    private final UserSettingsMapper userSettingsMapper;

    private final UserSettingsLlmConfigSupport llmConfigSupport;

    @Override
    @Transactional
    public UserSettingsDto getSettings(Long userId) {
        log.debug("Getting settings for user: {}", userId);
        UserSettings settings = findOrCreateSettings(userId);
        return convertToDto(settings);
    }

    @Override
    @Transactional
    public UserSettingsDto updateSettings(Long userId, UpdateSettingsRequest request) {
        log.debug("Updating settings for user: {}", userId);
        UserSettings settings = findOrCreateSettings(userId);
        userSettingsMapper.updateBasicFields(request, settings);
        applyNotificationConfig(settings, request);
        applyTradingConfig(settings, request);
        applyDisplayConfig(settings, request);
        llmConfigSupport.applyLlmConfig(settings, request.getLlmConfig());
        applyQuickLinks(settings, request);

        UserSettings saved = settingsRepository.save(Objects.requireNonNull(settings, "settings must not be null"));
        return convertToDto(saved);
    }

    @Override
    @Transactional
    public UserSettingsDto updateTheme(Long userId, String theme) {
        log.debug("Updating theme for user: {}, theme: {}", userId, theme);
        UserSettings settings = findOrCreateSettings(userId);
        settings.setTheme(theme);
        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }

    @Override
    @Transactional
    public UserSettingsDto updateNotification(Long userId, UpdateNotificationRequest request) {
        log.debug("Updating notification settings for user: {}", userId);
        UserSettings settings = findOrCreateSettings(userId);
        UserSettings.NotificationConfig config = settings.getNotificationConfig();
        if (config == null) {
            config = new UserSettings.NotificationConfig();
        }
        userSettingsMapper.updateNotificationConfig(request, config);
        settings.setNotificationConfig(config);
        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }

    @Override
    @Transactional
    public LlmConfigDto getEffectiveLlmConfig(Long userId, String provider) {
        UserSettings settings = findOrCreateSettings(userId);
        return llmConfigSupport.getEffectiveLlmConfig(userId, provider, settings.getLlmConfig());
    }

    private void applyNotificationConfig(UserSettings settings, UpdateSettingsRequest request) {
        NotificationConfigDto notification = request.getNotification();
        if (notification != null) {
            settings.setNotificationConfig(userSettingsMapper.toNotificationConfig(notification));
        }
    }

    private void applyTradingConfig(UserSettings settings, UpdateSettingsRequest request) {
        TradingConfigDto trading = request.getTrading();
        if (trading != null) {
            settings.setTradingConfig(userSettingsMapper.toTradingConfig(trading));
        }
    }

    private void applyDisplayConfig(UserSettings settings, UpdateSettingsRequest request) {
        DisplayConfigDto display = request.getDisplay();
        if (display != null) {
            settings.setDisplayConfig(userSettingsMapper.toDisplayConfig(display));
        }
    }

    private void applyQuickLinks(UserSettings settings, UpdateSettingsRequest request) {
        List<QuickLinkDto> quickLinks = request.getQuickLinks();
        if (quickLinks != null) {
            settings.setQuickLinks(userSettingsMapper.toQuickLinks(quickLinks));
        }
    }

    private UserSettings createDefaultSettings(Long userId) {
        log.debug("Creating default settings for user: {}", userId);
        UserSettings settings = UserSettings.builder()
            .userId(userId)
            .theme("light")
            .language("zh-CN")
            .timezone("Asia/Shanghai")
            .notificationConfig(new UserSettings.NotificationConfig())
            .tradingConfig(new UserSettings.TradingConfig())
            .displayConfig(new UserSettings.DisplayConfig())
            .llmConfig(UserSettings.LlmConfig.builder()
                .provider(PROVIDER_MINIMAX)
                .minimax(new UserSettings.ProviderConfig())
                .deepseek(new UserSettings.ProviderConfig())
                .openai(new UserSettings.ProviderConfig())
                .memory(UserSettings.MemoryConfig.builder()
                    .enabled(true)
                    .mode("L0")
                    .enableL1(true)
                    .enableL2(true)
                    .enableL3(true)
                    .build())
                .build())
            .quickLinks(List.of(
                UserSettings.QuickLink.builder()
                    .id(1L)
                    .name("自选股")
                    .icon("Star")
                    .path("/watchlist")
                    .sortOrder(1)
                    .build(),
                UserSettings.QuickLink.builder()
                    .id(2L)
                    .name("投资组合")
                    .icon("PieChart")
                    .path("/portfolio")
                    .sortOrder(2)
                    .build()))
            .build();
        return settingsRepository.save(Objects.requireNonNull(settings, "settings must not be null"));
    }

    private UserSettingsDto convertToDto(UserSettings settings) {
        UserSettingsDto dto = userSettingsMapper.toDto(settings);
        dto.setLlmConfig(llmConfigSupport.resolveLlmConfig(settings.getLlmConfig()));
        return dto;
    }

    private UserSettings findOrCreateSettings(Long userId) {
        return settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));
    }
}
