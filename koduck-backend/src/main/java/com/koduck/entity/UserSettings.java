package com.koduck.entity;

import com.koduck.util.CollectionCopyUtils;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 
 */
@Entity
@Table(name = "user_settings")
@Data
@NoArgsConstructor
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    // 
    @Column(name = "theme", nullable = false, length = 20)
    private String theme = "light";

    @Column(name = "language", nullable = false, length = 10)
    private String language = "zh-CN";

    @Column(name = "timezone", nullable = false, length = 50)
    private String timezone = "Asia/Shanghai";

    // 
    @Column(name = "notification_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private NotificationConfig notificationConfig = new NotificationConfig();

    // 
    @Column(name = "trading_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private TradingConfig tradingConfig = new TradingConfig();

    // 
    @Column(name = "display_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private DisplayConfig displayConfig = new DisplayConfig();

    // 
    @Column(name = "quick_links", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<QuickLink> quickLinks = List.of();

    // 
    @Column(name = "llm_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private LlmConfig llmConfig = new LlmConfig();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long id;
        private Long userId;
        private String theme;
        private String language;
        private String timezone;
        private NotificationConfig notificationConfig;
        private TradingConfig tradingConfig;
        private DisplayConfig displayConfig;
        private List<QuickLink> quickLinks;
        private LlmConfig llmConfig;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder theme(String theme) { this.theme = theme; return this; }
        public Builder language(String language) { this.language = language; return this; }
        public Builder timezone(String timezone) { this.timezone = timezone; return this; }
        public Builder notificationConfig(NotificationConfig notificationConfig) { this.notificationConfig = copyNotificationConfig(notificationConfig); return this; }
        public Builder tradingConfig(TradingConfig tradingConfig) { this.tradingConfig = copyTradingConfig(tradingConfig); return this; }
        public Builder displayConfig(DisplayConfig displayConfig) { this.displayConfig = copyDisplayConfig(displayConfig); return this; }
        public Builder quickLinks(List<QuickLink> quickLinks) { this.quickLinks = CollectionCopyUtils.copyList(quickLinks); return this; }
        public Builder llmConfig(LlmConfig llmConfig) { this.llmConfig = copyLlmConfig(llmConfig); return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

        public UserSettings build() {
            UserSettings settings = new UserSettings();
            settings.setId(id);
            settings.setUserId(userId);
            settings.setTheme(theme);
            settings.setLanguage(language);
            settings.setTimezone(timezone);
            settings.setNotificationConfig(notificationConfig);
            settings.setTradingConfig(tradingConfig);
            settings.setDisplayConfig(displayConfig);
            settings.setQuickLinks(quickLinks);
            settings.setLlmConfig(llmConfig);
            settings.setCreatedAt(createdAt);
            settings.setUpdatedAt(updatedAt);
            return settings;
        }
    }

    public NotificationConfig getNotificationConfig() {
        return copyNotificationConfig(notificationConfig);
    }

    public void setNotificationConfig(NotificationConfig notificationConfig) {
        this.notificationConfig = copyNotificationConfig(notificationConfig);
    }

    public TradingConfig getTradingConfig() {
        return copyTradingConfig(tradingConfig);
    }

    public void setTradingConfig(TradingConfig tradingConfig) {
        this.tradingConfig = copyTradingConfig(tradingConfig);
    }

    public DisplayConfig getDisplayConfig() {
        return copyDisplayConfig(displayConfig);
    }

    public void setDisplayConfig(DisplayConfig displayConfig) {
        this.displayConfig = copyDisplayConfig(displayConfig);
    }

    public List<QuickLink> getQuickLinks() {
        return CollectionCopyUtils.copyList(quickLinks);
    }

    public void setQuickLinks(List<QuickLink> quickLinks) {
        this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
    }

    public LlmConfig getLlmConfig() {
        return copyLlmConfig(llmConfig);
    }

    public void setLlmConfig(LlmConfig llmConfig) {
        this.llmConfig = copyLlmConfig(llmConfig);
    }

    private static NotificationConfig copyNotificationConfig(NotificationConfig source) {
        if (source == null) {
            return null;
        }
        return NotificationConfig.builder()
                .email(source.getEmail())
                .browser(source.getBrowser())
                .priceAlert(source.getPriceAlert())
                .tradeAlert(source.getTradeAlert())
                .strategyAlert(source.getStrategyAlert())
                .build();
    }

    private static TradingConfig copyTradingConfig(TradingConfig source) {
        if (source == null) {
            return null;
        }
        return TradingConfig.builder()
                .defaultMarket(source.getDefaultMarket())
                .commissionRate(source.getCommissionRate())
                .minCommission(source.getMinCommission())
                .enableConfirmation(source.getEnableConfirmation())
                .build();
    }

    private static DisplayConfig copyDisplayConfig(DisplayConfig source) {
        if (source == null) {
            return null;
        }
        return DisplayConfig.builder()
                .currency(source.getCurrency())
                .dateFormat(source.getDateFormat())
                .numberFormat(source.getNumberFormat())
                .compactMode(source.getCompactMode())
                .build();
    }

    private static LlmConfig copyLlmConfig(LlmConfig source) {
        if (source == null) {
            return null;
        }
        return LlmConfig.builder()
                .provider(source.getProvider())
                .apiKey(source.getApiKey())
                .apiBase(source.getApiBase())
                .minimax(copyProviderConfig(source.getMinimax()))
                .deepseek(copyProviderConfig(source.getDeepseek()))
                .openai(copyProviderConfig(source.getOpenai()))
                .memory(copyMemoryConfig(source.getMemory()))
                .build();
    }

    private static ProviderConfig copyProviderConfig(ProviderConfig source) {
        if (source == null) {
            return null;
        }
        return ProviderConfig.builder()
                .apiKey(source.getApiKey())
                .apiBase(source.getApiBase())
                .build();
    }

    private static MemoryConfig copyMemoryConfig(MemoryConfig source) {
        if (source == null) {
            return null;
        }
        return MemoryConfig.builder()
                .enabled(source.getEnabled())
                .mode(source.getMode())
                .enableL1(source.getEnableL1())
                .enableL2(source.getEnableL2())
                .enableL3(source.getEnableL3())
                .build();
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    public static class NotificationConfig {
        private Boolean email = true;
        private Boolean browser = true;
        private Boolean priceAlert = true;
        private Boolean tradeAlert = true;
        private Boolean strategyAlert = true;

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

            public NotificationConfig build() {
                NotificationConfig config = new NotificationConfig();
                if (email != null) {
                    config.setEmail(email);
                }
                if (browser != null) {
                    config.setBrowser(browser);
                }
                if (priceAlert != null) {
                    config.setPriceAlert(priceAlert);
                }
                if (tradeAlert != null) {
                    config.setTradeAlert(tradeAlert);
                }
                if (strategyAlert != null) {
                    config.setStrategyAlert(strategyAlert);
                }
                return config;
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    public static class TradingConfig {
        private String defaultMarket = "US";
        private Double commissionRate = 0.001;
        private Double minCommission = 0.0;
        private Boolean enableConfirmation = true;

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

            public TradingConfig build() {
                TradingConfig config = new TradingConfig();
                if (defaultMarket != null) {
                    config.setDefaultMarket(defaultMarket);
                }
                if (commissionRate != null) {
                    config.setCommissionRate(commissionRate);
                }
                if (minCommission != null) {
                    config.setMinCommission(minCommission);
                }
                if (enableConfirmation != null) {
                    config.setEnableConfirmation(enableConfirmation);
                }
                return config;
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    public static class DisplayConfig {
        private String currency = "USD";
        private String dateFormat = "YYYY-MM-DD";
        private String numberFormat = "comma";
        private Boolean compactMode = false;

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

            public DisplayConfig build() {
                DisplayConfig config = new DisplayConfig();
                if (currency != null) {
                    config.setCurrency(currency);
                }
                if (dateFormat != null) {
                    config.setDateFormat(dateFormat);
                }
                if (numberFormat != null) {
                    config.setNumberFormat(numberFormat);
                }
                if (compactMode != null) {
                    config.setCompactMode(compactMode);
                }
                return config;
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    public static class QuickLink {
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

            public QuickLink build() {
                QuickLink link = new QuickLink();
                link.setId(id);
                link.setName(name);
                link.setIcon(icon);
                link.setPath(path);
                link.setSortOrder(sortOrder);
                return link;
            }
        }
    }

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    public static class LlmConfig {
        private String provider;
        // legacy ，
        private String apiKey;
        private String apiBase;
        private ProviderConfig minimax;
        private ProviderConfig deepseek;
        private ProviderConfig openai;
        private MemoryConfig memory = new MemoryConfig();

        public static Builder builder() {
            return new Builder();
        }

        public static final class Builder {

            private String provider;
            private String apiKey;
            private String apiBase;
            private ProviderConfig minimax;
            private ProviderConfig deepseek;
            private ProviderConfig openai;
            private MemoryConfig memory;

            public Builder provider(String provider) { this.provider = provider; return this; }
            public Builder apiKey(String apiKey) { this.apiKey = apiKey; return this; }
            public Builder apiBase(String apiBase) { this.apiBase = apiBase; return this; }
            public Builder minimax(ProviderConfig minimax) { this.minimax = copyProviderConfig(minimax); return this; }
            public Builder deepseek(ProviderConfig deepseek) { this.deepseek = copyProviderConfig(deepseek); return this; }
            public Builder openai(ProviderConfig openai) { this.openai = copyProviderConfig(openai); return this; }
            public Builder memory(MemoryConfig memory) { this.memory = copyMemoryConfig(memory); return this; }

            public LlmConfig build() {
                LlmConfig config = new LlmConfig();
                config.setProvider(provider);
                config.setApiKey(apiKey);
                config.setApiBase(apiBase);
                config.setMinimax(minimax);
                config.setDeepseek(deepseek);
                config.setOpenai(openai);
                config.setMemory(memory);
                return config;
            }
        }

        public ProviderConfig getMinimax() {
            return copyProviderConfig(minimax);
        }

        public void setMinimax(ProviderConfig minimax) {
            this.minimax = copyProviderConfig(minimax);
        }

        public ProviderConfig getDeepseek() {
            return copyProviderConfig(deepseek);
        }

        public void setDeepseek(ProviderConfig deepseek) {
            this.deepseek = copyProviderConfig(deepseek);
        }

        public ProviderConfig getOpenai() {
            return copyProviderConfig(openai);
        }

        public void setOpenai(ProviderConfig openai) {
            this.openai = copyProviderConfig(openai);
        }

        public MemoryConfig getMemory() {
            return copyMemoryConfig(memory);
        }

        public void setMemory(MemoryConfig memory) {
            this.memory = copyMemoryConfig(memory);
        }
    }

    @Data
    @NoArgsConstructor
    public static class ProviderConfig {
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

            public ProviderConfig build() {
                ProviderConfig config = new ProviderConfig();
                config.setApiKey(apiKey);
                config.setApiBase(apiBase);
                return config;
            }
        }
    }

    @Data
    @NoArgsConstructor
    public static class MemoryConfig {
        private Boolean enabled = true;
        private String mode = "L0";
        private Boolean enableL1 = true;
        private Boolean enableL2 = true;
        private Boolean enableL3 = true;

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

            public MemoryConfig build() {
                MemoryConfig config = new MemoryConfig();
                if (enabled != null) {
                    config.setEnabled(enabled);
                }
                if (mode != null) {
                    config.setMode(mode);
                }
                if (enableL1 != null) {
                    config.setEnableL1(enableL1);
                }
                if (enableL2 != null) {
                    config.setEnableL2(enableL2);
                }
                if (enableL3 != null) {
                    config.setEnableL3(enableL3);
                }
                return config;
            }
        }
    }

}
