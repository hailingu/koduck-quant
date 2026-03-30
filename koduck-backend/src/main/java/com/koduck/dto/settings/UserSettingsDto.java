package com.koduck.dto.settings;

import com.koduck.util.CollectionCopyUtils;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSettingsDto {

    private Long id;
    private Long userId;

    // 
    private String theme;
    private String language;
    private String timezone;

    // 
    private NotificationConfigDto notification;

    // 
    private TradingConfigDto trading;

    // 
    private DisplayConfigDto display;

    // 
    private List<QuickLinkDto> quickLinks;

    // 
    private LlmConfigDto llmConfig;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public NotificationConfigDto getNotification() {
        return copyNotification(notification);
    }

    public void setNotification(NotificationConfigDto notification) {
        this.notification = copyNotification(notification);
    }

    public TradingConfigDto getTrading() {
        return copyTrading(trading);
    }

    public void setTrading(TradingConfigDto trading) {
        this.trading = copyTrading(trading);
    }

    public DisplayConfigDto getDisplay() {
        return copyDisplay(display);
    }

    public void setDisplay(DisplayConfigDto display) {
        this.display = copyDisplay(display);
    }

    public List<QuickLinkDto> getQuickLinks() {
        return CollectionCopyUtils.copyList(quickLinks);
    }

    public void setQuickLinks(List<QuickLinkDto> quickLinks) {
        this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
    }

    public LlmConfigDto getLlmConfig() {
        return copyLlmConfig(llmConfig);
    }

    public void setLlmConfig(LlmConfigDto llmConfig) {
        this.llmConfig = copyLlmConfig(llmConfig);
    }

    private static NotificationConfigDto copyNotification(NotificationConfigDto source) {
        if (source == null) {
            return null;
        }
        return NotificationConfigDto.builder()
                .email(source.getEmail())
                .browser(source.getBrowser())
                .priceAlert(source.getPriceAlert())
                .tradeAlert(source.getTradeAlert())
                .strategyAlert(source.getStrategyAlert())
                .build();
    }

    private static TradingConfigDto copyTrading(TradingConfigDto source) {
        if (source == null) {
            return null;
        }
        return TradingConfigDto.builder()
                .defaultMarket(source.getDefaultMarket())
                .commissionRate(source.getCommissionRate())
                .minCommission(source.getMinCommission())
                .enableConfirmation(source.getEnableConfirmation())
                .build();
    }

    private static DisplayConfigDto copyDisplay(DisplayConfigDto source) {
        if (source == null) {
            return null;
        }
        return DisplayConfigDto.builder()
                .currency(source.getCurrency())
                .dateFormat(source.getDateFormat())
                .numberFormat(source.getNumberFormat())
                .compactMode(source.getCompactMode())
                .build();
    }

    private static LlmConfigDto copyLlmConfig(LlmConfigDto source) {
        if (source == null) {
            return null;
        }
        return LlmConfigDto.builder()
                .provider(source.getProvider())
                .apiKey(source.getApiKey())
                .apiBase(source.getApiBase())
                .minimax(copyProviderConfig(source.getMinimax()))
                .deepseek(copyProviderConfig(source.getDeepseek()))
                .openai(copyProviderConfig(source.getOpenai()))
                .memory(copyMemoryConfig(source.getMemory()))
                .build();
    }

    private static ProviderConfigDto copyProviderConfig(ProviderConfigDto source) {
        if (source == null) {
            return null;
        }
        return ProviderConfigDto.builder()
                .apiKey(source.getApiKey())
                .apiBase(source.getApiBase())
                .build();
    }

    private static MemoryConfigDto copyMemoryConfig(MemoryConfigDto source) {
        if (source == null) {
            return null;
        }
        return MemoryConfigDto.builder()
                .enabled(source.getEnabled())
                .mode(source.getMode())
                .enableL1(source.getEnableL1())
                .enableL2(source.getEnableL2())
                .enableL3(source.getEnableL3())
                .build();
    }

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

        public ProviderConfigDto getMinimax() {
            return copyProviderConfig(minimax);
        }

        public void setMinimax(ProviderConfigDto minimax) {
            this.minimax = copyProviderConfig(minimax);
        }

        public ProviderConfigDto getDeepseek() {
            return copyProviderConfig(deepseek);
        }

        public void setDeepseek(ProviderConfigDto deepseek) {
            this.deepseek = copyProviderConfig(deepseek);
        }

        public ProviderConfigDto getOpenai() {
            return copyProviderConfig(openai);
        }

        public void setOpenai(ProviderConfigDto openai) {
            this.openai = copyProviderConfig(openai);
        }

        public MemoryConfigDto getMemory() {
            return copyMemoryConfig(memory);
        }

        public void setMemory(MemoryConfigDto memory) {
            this.memory = copyMemoryConfig(memory);
        }
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
