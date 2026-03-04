package com.koduck.service;

import com.koduck.dto.settings.*;
import com.koduck.entity.UserSettings;
import com.koduck.exception.BusinessException;
import com.koduck.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 用户设置服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserSettingsService {

    private final UserSettingsRepository settingsRepository;

    /**
     * 获取或创建设置
     */
    @Transactional(readOnly = true)
    public UserSettingsDto getSettings(Long userId) {
        log.debug("Getting settings for user: {}", userId);

        UserSettings settings = settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));

        return convertToDto(settings);
    }

    /**
     * 更新设置
     */
    @Transactional
    public UserSettingsDto updateSettings(Long userId, UpdateSettingsRequest request) {
        log.debug("Updating settings for user: {}", userId);

        UserSettings settings = settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));

        // 更新主题设置
        if (request.getTheme() != null) {
            settings.setTheme(request.getTheme());
        }
        if (request.getLanguage() != null) {
            settings.setLanguage(request.getLanguage());
        }
        if (request.getTimezone() != null) {
            settings.setTimezone(request.getTimezone());
        }

        // 更新通知设置
        if (request.getNotification() != null) {
            UserSettings.NotificationConfig config = new UserSettings.NotificationConfig();
            config.setEmail(request.getNotification().getEmail());
            config.setBrowser(request.getNotification().getBrowser());
            config.setPriceAlert(request.getNotification().getPriceAlert());
            config.setTradeAlert(request.getNotification().getTradeAlert());
            config.setStrategyAlert(request.getNotification().getStrategyAlert());
            settings.setNotificationConfig(config);
        }

        // 更新交易设置
        if (request.getTrading() != null) {
            UserSettings.TradingConfig config = new UserSettings.TradingConfig();
            config.setDefaultMarket(request.getTrading().getDefaultMarket());
            config.setCommissionRate(request.getTrading().getCommissionRate());
            config.setMinCommission(request.getTrading().getMinCommission());
            config.setEnableConfirmation(request.getTrading().getEnableConfirmation());
            settings.setTradingConfig(config);
        }

        // 更新显示设置
        if (request.getDisplay() != null) {
            UserSettings.DisplayConfig config = new UserSettings.DisplayConfig();
            config.setCurrency(request.getDisplay().getCurrency());
            config.setDateFormat(request.getDisplay().getDateFormat());
            config.setNumberFormat(request.getDisplay().getNumberFormat());
            config.setCompactMode(request.getDisplay().getCompactMode());
            settings.setDisplayConfig(config);
        }

        // 更新快捷入口
        if (request.getQuickLinks() != null) {
            List<UserSettings.QuickLink> links = request.getQuickLinks().stream()
                .map(dto -> UserSettings.QuickLink.builder()
                    .id(dto.getId())
                    .name(dto.getName())
                    .icon(dto.getIcon())
                    .path(dto.getPath())
                    .sortOrder(dto.getSortOrder())
                    .build())
                .collect(Collectors.toList());
            settings.setQuickLinks(links);
        }

        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }

    /**
     * 更新主题
     */
    @Transactional
    public UserSettingsDto updateTheme(Long userId, String theme) {
        log.debug("Updating theme for user: {}, theme: {}", userId, theme);

        UserSettings settings = settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));

        settings.setTheme(theme);
        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }

    /**
     * 更新通知设置
     */
    @Transactional
    public UserSettingsDto updateNotification(Long userId, UpdateNotificationRequest request) {
        log.debug("Updating notification settings for user: {}", userId);

        UserSettings settings = settingsRepository.findByUserId(userId)
            .orElseGet(() -> createDefaultSettings(userId));

        UserSettings.NotificationConfig config = settings.getNotificationConfig();
        if (config == null) {
            config = new UserSettings.NotificationConfig();
        }

        if (request.getEmail() != null) config.setEmail(request.getEmail());
        if (request.getBrowser() != null) config.setBrowser(request.getBrowser());
        if (request.getPriceAlert() != null) config.setPriceAlert(request.getPriceAlert());
        if (request.getTradeAlert() != null) config.setTradeAlert(request.getTradeAlert());
        if (request.getStrategyAlert() != null) config.setStrategyAlert(request.getStrategyAlert());

        settings.setNotificationConfig(config);
        UserSettings saved = settingsRepository.save(settings);
        return convertToDto(saved);
    }

    /**
     * 创建默认设置
     */
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
                    .build()
            ))
            .build();

        return settingsRepository.save(settings);
    }

    /**
     * 转换为 DTO
     */
    private UserSettingsDto convertToDto(UserSettings settings) {
        return UserSettingsDto.builder()
            .id(settings.getId())
            .userId(settings.getUserId())
            .theme(settings.getTheme())
            .language(settings.getLanguage())
            .timezone(settings.getTimezone())
            .notification(convertNotificationToDto(settings.getNotificationConfig()))
            .trading(convertTradingToDto(settings.getTradingConfig()))
            .display(convertDisplayToDto(settings.getDisplayConfig()))
            .quickLinks(convertQuickLinksToDto(settings.getQuickLinks()))
            .createdAt(settings.getCreatedAt())
            .updatedAt(settings.getUpdatedAt())
            .build();
    }

    private UserSettingsDto.NotificationConfigDto convertNotificationToDto(
            UserSettings.NotificationConfig config) {
        if (config == null) return null;
        return UserSettingsDto.NotificationConfigDto.builder()
            .email(config.getEmail())
            .browser(config.getBrowser())
            .priceAlert(config.getPriceAlert())
            .tradeAlert(config.getTradeAlert())
            .strategyAlert(config.getStrategyAlert())
            .build();
    }

    private UserSettingsDto.TradingConfigDto convertTradingToDto(
            UserSettings.TradingConfig config) {
        if (config == null) return null;
        return UserSettingsDto.TradingConfigDto.builder()
            .defaultMarket(config.getDefaultMarket())
            .commissionRate(config.getCommissionRate())
            .minCommission(config.getMinCommission())
            .enableConfirmation(config.getEnableConfirmation())
            .build();
    }

    private UserSettingsDto.DisplayConfigDto convertDisplayToDto(
            UserSettings.DisplayConfig config) {
        if (config == null) return null;
        return UserSettingsDto.DisplayConfigDto.builder()
            .currency(config.getCurrency())
            .dateFormat(config.getDateFormat())
            .numberFormat(config.getNumberFormat())
            .compactMode(config.getCompactMode())
            .build();
    }

    private List<UserSettingsDto.QuickLinkDto> convertQuickLinksToDto(
            List<UserSettings.QuickLink> links) {
        if (links == null) return List.of();
        return links.stream()
            .map(link -> UserSettingsDto.QuickLinkDto.builder()
                .id(link.getId())
                .name(link.getName())
                .icon(link.getIcon())
                .path(link.getPath())
                .sortOrder(link.getSortOrder())
                .build())
            .collect(Collectors.toList());
    }
}
