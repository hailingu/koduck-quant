package com.koduck.dto.settings;

import com.koduck.util.CollectionCopyUtils;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
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

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private String theme;
        private String language;
        private String timezone;
        private NotificationConfigDto notification;
        private TradingConfigDto trading;
        private DisplayConfigDto display;
        private List<QuickLinkDto> quickLinks;
        private LlmConfigDto llmConfig;

        public Builder theme(String theme) { this.theme = theme; return this; }
        public Builder language(String language) { this.language = language; return this; }
        public Builder timezone(String timezone) { this.timezone = timezone; return this; }
        public Builder notification(NotificationConfigDto notification) { this.notification = copyNotification(notification); return this; }
        public Builder trading(TradingConfigDto trading) { this.trading = copyTrading(trading); return this; }
        public Builder display(DisplayConfigDto display) { this.display = copyDisplay(display); return this; }
        public Builder quickLinks(List<QuickLinkDto> quickLinks) { this.quickLinks = CollectionCopyUtils.copyList(quickLinks); return this; }
        public Builder llmConfig(LlmConfigDto llmConfig) { this.llmConfig = copyLlmConfig(llmConfig); return this; }

        public UpdateSettingsRequest build() {
            UpdateSettingsRequest request = new UpdateSettingsRequest();
            request.setTheme(theme);
            request.setLanguage(language);
            request.setTimezone(timezone);
            request.setNotification(notification);
            request.setTrading(trading);
            request.setDisplay(display);
            request.setQuickLinks(quickLinks);
            request.setLlmConfig(llmConfig);
            return request;
        }
    }

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
    @NoArgsConstructor
    public static class NotificationConfigDto {
        private Boolean email;
        private Boolean browser;
        private Boolean priceAlert;
        private Boolean tradeAlert;
        private Boolean strategyAlert;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private Boolean email;
            private Boolean browser;
            private Boolean priceAlert;
            private Boolean tradeAlert;
            private Boolean strategyAlert;

            public Builder email(Boolean email) { this.email = email; return this; }
            public Builder browser(Boolean browser) { this.browser = browser; return this; }
            public Builder priceAlert(Boolean priceAlert) { this.priceAlert = priceAlert; return this; }
            public Builder tradeAlert(Boolean tradeAlert) { this.tradeAlert = tradeAlert; return this; }
            public Builder strategyAlert(Boolean strategyAlert) { this.strategyAlert = strategyAlert; return this; }

            public NotificationConfigDto build() {
                NotificationConfigDto dto = new NotificationConfigDto();
                dto.setEmail(email);
                dto.setBrowser(browser);
                dto.setPriceAlert(priceAlert);
                dto.setTradeAlert(tradeAlert);
                dto.setStrategyAlert(strategyAlert);
                return dto;
            }
        }
    }

    /**
     *  DTO
     */
    @Data
    @NoArgsConstructor
    public static class TradingConfigDto {
        private String defaultMarket;
        private Double commissionRate;
        private Double minCommission;
        private Boolean enableConfirmation;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String defaultMarket;
            private Double commissionRate;
            private Double minCommission;
            private Boolean enableConfirmation;

            public Builder defaultMarket(String defaultMarket) { this.defaultMarket = defaultMarket; return this; }
            public Builder commissionRate(Double commissionRate) { this.commissionRate = commissionRate; return this; }
            public Builder minCommission(Double minCommission) { this.minCommission = minCommission; return this; }
            public Builder enableConfirmation(Boolean enableConfirmation) { this.enableConfirmation = enableConfirmation; return this; }

            public TradingConfigDto build() {
                TradingConfigDto dto = new TradingConfigDto();
                dto.setDefaultMarket(defaultMarket);
                dto.setCommissionRate(commissionRate);
                dto.setMinCommission(minCommission);
                dto.setEnableConfirmation(enableConfirmation);
                return dto;
            }
        }
    }

    /**
     *  DTO
     */
    @Data
    @NoArgsConstructor
    public static class DisplayConfigDto {
        private String currency;
        private String dateFormat;
        private String numberFormat;
        private Boolean compactMode;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String currency;
            private String dateFormat;
            private String numberFormat;
            private Boolean compactMode;

            public Builder currency(String currency) { this.currency = currency; return this; }
            public Builder dateFormat(String dateFormat) { this.dateFormat = dateFormat; return this; }
            public Builder numberFormat(String numberFormat) { this.numberFormat = numberFormat; return this; }
            public Builder compactMode(Boolean compactMode) { this.compactMode = compactMode; return this; }

            public DisplayConfigDto build() {
                DisplayConfigDto dto = new DisplayConfigDto();
                dto.setCurrency(currency);
                dto.setDateFormat(dateFormat);
                dto.setNumberFormat(numberFormat);
                dto.setCompactMode(compactMode);
                return dto;
            }
        }
    }

    /**
     *  DTO
     */
    @Data
    @NoArgsConstructor
    public static class QuickLinkDto {
        private Long id;
        private String name;
        private String icon;
        private String path;
        private Integer sortOrder;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private Long id;
            private String name;
            private String icon;
            private String path;
            private Integer sortOrder;

            public Builder id(Long id) { this.id = id; return this; }
            public Builder name(String name) { this.name = name; return this; }
            public Builder icon(String icon) { this.icon = icon; return this; }
            public Builder path(String path) { this.path = path; return this; }
            public Builder sortOrder(Integer sortOrder) { this.sortOrder = sortOrder; return this; }

            public QuickLinkDto build() {
                QuickLinkDto dto = new QuickLinkDto();
                dto.setId(id);
                dto.setName(name);
                dto.setIcon(icon);
                dto.setPath(path);
                dto.setSortOrder(sortOrder);
                return dto;
            }
        }
    }

    /**
     *  DTO
     */
    @Data
    @NoArgsConstructor
    public static class LlmConfigDto {
        private String provider;
        //  provider （）
        private String apiKey;
        private String apiBase;
        private ProviderConfigDto minimax;
        private ProviderConfigDto deepseek;
        private ProviderConfigDto openai;
        private MemoryConfigDto memory;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String provider;
            private String apiKey;
            private String apiBase;
            private ProviderConfigDto minimax;
            private ProviderConfigDto deepseek;
            private ProviderConfigDto openai;
            private MemoryConfigDto memory;

            public Builder provider(String provider) { this.provider = provider; return this; }
            public Builder apiKey(String apiKey) { this.apiKey = apiKey; return this; }
            public Builder apiBase(String apiBase) { this.apiBase = apiBase; return this; }
            public Builder minimax(ProviderConfigDto minimax) { this.minimax = copyProviderConfig(minimax); return this; }
            public Builder deepseek(ProviderConfigDto deepseek) { this.deepseek = copyProviderConfig(deepseek); return this; }
            public Builder openai(ProviderConfigDto openai) { this.openai = copyProviderConfig(openai); return this; }
            public Builder memory(MemoryConfigDto memory) { this.memory = copyMemoryConfig(memory); return this; }

            public LlmConfigDto build() {
                LlmConfigDto dto = new LlmConfigDto();
                dto.setProvider(provider);
                dto.setApiKey(apiKey);
                dto.setApiBase(apiBase);
                dto.setMinimax(minimax);
                dto.setDeepseek(deepseek);
                dto.setOpenai(openai);
                dto.setMemory(memory);
                return dto;
            }
        }

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
    @NoArgsConstructor
    public static class ProviderConfigDto {
        private String apiKey;
        private String apiBase;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String apiKey;
            private String apiBase;

            public Builder apiKey(String apiKey) { this.apiKey = apiKey; return this; }
            public Builder apiBase(String apiBase) { this.apiBase = apiBase; return this; }

            public ProviderConfigDto build() {
                ProviderConfigDto dto = new ProviderConfigDto();
                dto.setApiKey(apiKey);
                dto.setApiBase(apiBase);
                return dto;
            }
        }
    }

    @Data
    @NoArgsConstructor
    public static class MemoryConfigDto {
        private Boolean enabled;
        private String mode;
        private Boolean enableL1;
        private Boolean enableL2;
        private Boolean enableL3;

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private Boolean enabled;
            private String mode;
            private Boolean enableL1;
            private Boolean enableL2;
            private Boolean enableL3;

            public Builder enabled(Boolean enabled) { this.enabled = enabled; return this; }
            public Builder mode(String mode) { this.mode = mode; return this; }
            public Builder enableL1(Boolean enableL1) { this.enableL1 = enableL1; return this; }
            public Builder enableL2(Boolean enableL2) { this.enableL2 = enableL2; return this; }
            public Builder enableL3(Boolean enableL3) { this.enableL3 = enableL3; return this; }

            public MemoryConfigDto build() {
                MemoryConfigDto dto = new MemoryConfigDto();
                dto.setEnabled(enabled);
                dto.setMode(mode);
                dto.setEnableL1(enableL1);
                dto.setEnableL2(enableL2);
                dto.setEnableL3(enableL3);
                return dto;
            }
        }
    }

}
