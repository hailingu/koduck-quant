package com.koduck.dto.settings;

import jakarta.validation.Valid;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSettingsRequest {

    // 
    private String theme;
    private String language;
    private String timezone;

    // 
    @Valid
    private NotificationConfigDto notification;

    // 
    @Valid
    private TradingConfigDto trading;

    // 
    @Valid
    private DisplayConfigDto display;

    // 
    private List<QuickLinkDto> quickLinks;

    // 
    @Valid
    private LlmConfigDto llmConfig;

    /**
     *  DTO
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
     *  DTO
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
     *  DTO
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
     *  DTO
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
     *  DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LlmConfigDto {
        private String provider;
        //  provider （）
        private String apiKey;
        private String apiBase;
        private ProviderConfigDto minimax;
        private ProviderConfigDto deepseek;
        private ProviderConfigDto openai;
        private MemoryConfigDto memory;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProviderConfigDto {
        private String apiKey;
        private String apiBase;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemoryConfigDto {
        private Boolean enabled;
        private String mode;
        private Boolean enableL1;
        private Boolean enableL2;
        private Boolean enableL3;
    }

}
