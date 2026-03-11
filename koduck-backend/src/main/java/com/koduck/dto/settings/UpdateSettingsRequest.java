package com.koduck.dto.settings;

import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 更新设置请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSettingsRequest {

    // 主题设置
    private String theme;
    private String language;
    private String timezone;

    // 通知设置
    @Valid
    private NotificationConfigDto notification;

    // 交易设置
    @Valid
    private TradingConfigDto trading;

    // 显示设置
    @Valid
    private DisplayConfigDto display;

    // 快捷入口
    private List<QuickLinkDto> quickLinks;

    // 大模型配置
    @Valid
    private LlmConfigDto llmConfig;

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

    /**
     * 大模型配置 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LlmConfigDto {
        private String provider;
        // 当前激活 provider 的输入值（兼容前端旧提交方式）
        private String apiKey;
        private String apiBase;
        private ProviderConfigDto minimax;
        private ProviderConfigDto deepseek;
        private ProviderConfigDto openai;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProviderConfigDto {
        private String apiKey;
        private String apiBase;
    }
}
