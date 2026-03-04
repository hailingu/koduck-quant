package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 用户设置 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSettingsDto {

    private Long id;
    private Long userId;

    // 主题设置
    private String theme;
    private String language;
    private String timezone;

    // 通知设置
    private NotificationConfigDto notification;

    // 交易设置
    private TradingConfigDto trading;

    // 显示设置
    private DisplayConfigDto display;

    // 快捷入口
    private List<QuickLinkDto> quickLinks;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * 通知配置 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationConfigDto {
        private Boolean email;
        private Boolean browser;
        private Boolean priceAlert;
        private Boolean tradeAlert;
        private Boolean strategyAlert;
    }

    /**
     * 交易配置 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TradingConfigDto {
        private String defaultMarket;
        private Double commissionRate;
        private Double minCommission;
        private Boolean enableConfirmation;
    }

    /**
     * 显示配置 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DisplayConfigDto {
        private String currency;
        private String dateFormat;
        private String numberFormat;
        private Boolean compactMode;
    }

    /**
     * 快捷入口 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuickLinkDto {
        private Long id;
        private String name;
        private String icon;
        private String path;
        private Integer sortOrder;
    }
}
