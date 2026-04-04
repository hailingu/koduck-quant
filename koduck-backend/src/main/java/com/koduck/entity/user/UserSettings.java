package com.koduck.entity.user;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import com.koduck.util.CollectionCopyUtils;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * User settings entity.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "user_settings")
@Data
@NoArgsConstructor
public class UserSettings {

    /**
     * Primary key.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * User ID.
     */
    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /**
     * Theme setting.
     */
    @Column(name = "theme", nullable = false, length = 20)
    private String theme = "light";

    /**
     * Language setting.
     */
    @Column(name = "language", nullable = false, length = 10)
    private String language = "zh-CN";

    /**
     * Timezone setting.
     */
    @Column(name = "timezone", nullable = false, length = 50)
    private String timezone = "Asia/Shanghai";

    /**
     * Notification configuration.
     */
    @Column(name = "notification_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private NotificationConfig notificationConfig = new NotificationConfig();

    /**
     * Trading configuration.
     */
    @Column(name = "trading_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private TradingConfig tradingConfig = new TradingConfig();

    /**
     * Display configuration.
     */
    @Column(name = "display_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private DisplayConfig displayConfig = new DisplayConfig();

    /**
     * Quick links list.
     */
    @Column(name = "quick_links", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<QuickLink> quickLinks = List.of();

    /**
     * LLM configuration.
     */
    @Column(name = "llm_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private LlmConfig llmConfig = new LlmConfig();

    /**
     * Created at.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Updated at.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Creates a new builder.
     *
     * @return BuilderWrapper instance
     */
    public static BuilderWrapper builder() {
        return new BuilderWrapper();
    }

    /**
     * Gets notification config copy.
     *
     * @return notification config copy
     */
    public NotificationConfig getNotificationConfig() {
        return copyNotificationConfig(notificationConfig);
    }

    /**
     * Sets notification config with copy.
     *
     * @param notificationConfig the notification config
     */
    public void setNotificationConfig(NotificationConfig notificationConfig) {
        this.notificationConfig = copyNotificationConfig(notificationConfig);
    }

    /**
     * Gets trading config copy.
     *
     * @return trading config copy
     */
    public TradingConfig getTradingConfig() {
        return copyTradingConfig(tradingConfig);
    }

    /**
     * Sets trading config with copy.
     *
     * @param tradingConfig the trading config
     */
    public void setTradingConfig(TradingConfig tradingConfig) {
        this.tradingConfig = copyTradingConfig(tradingConfig);
    }

    /**
     * Gets display config copy.
     *
     * @return display config copy
     */
    public DisplayConfig getDisplayConfig() {
        return copyDisplayConfig(displayConfig);
    }

    /**
     * Sets display config with copy.
     *
     * @param displayConfig the display config
     */
    public void setDisplayConfig(DisplayConfig displayConfig) {
        this.displayConfig = copyDisplayConfig(displayConfig);
    }

    /**
     * Gets quick links copy.
     *
     * @return quick links copy
     */
    public List<QuickLink> getQuickLinks() {
        return CollectionCopyUtils.copyList(quickLinks);
    }

    /**
     * Sets quick links with copy.
     *
     * @param quickLinks the quick links
     */
    public void setQuickLinks(List<QuickLink> quickLinks) {
        this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
    }

    /**
     * Gets LLM config copy.
     *
     * @return LLM config copy
     */
    public LlmConfig getLlmConfig() {
        return copyLlmConfig(llmConfig);
    }

    /**
     * Sets LLM config with copy.
     *
     * @param llmConfig the LLM config
     */
    public void setLlmConfig(LlmConfig llmConfig) {
        this.llmConfig = copyLlmConfig(llmConfig);
    }

    /**
     * Copies notification config.
     *
     * @param source the source
     * @return copied config
     */
    private static NotificationConfig copyNotificationConfig(NotificationConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * Copies trading config.
     *
     * @param source the source
     * @return copied config
     */
    private static TradingConfig copyTradingConfig(TradingConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * Copies display config.
     *
     * @param source the source
     * @return copied config
     */
    private static DisplayConfig copyDisplayConfig(DisplayConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * Copies LLM config.
     *
     * @param source the source
     * @return copied config
     */
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

    /**
     * Copies provider config.
     *
     * @param source the source
     * @return copied config
     */
    private static ProviderConfig copyProviderConfig(ProviderConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * Copies memory config.
     *
     * @param source the source
     * @return copied config
     */
    private static MemoryConfig copyMemoryConfig(MemoryConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * Builder wrapper class for UserSettings.
     */
    public static final class BuilderWrapper {

        /**
         * The ID.
         */
        private Long id;

        /**
         * The user ID.
         */
        private Long userId;

        /**
         * The theme.
         */
        private String theme;

        /**
         * The language.
         */
        private String language;

        /**
         * The timezone.
         */
        private String timezone;

        /**
         * The notification config.
         */
        private NotificationConfig notificationConfig;

        /**
         * The trading config.
         */
        private TradingConfig tradingConfig;

        /**
         * The display config.
         */
        private DisplayConfig displayConfig;

        /**
         * The quick links.
         */
        private List<QuickLink> quickLinks;

        /**
         * The LLM config.
         */
        private LlmConfig llmConfig;

        /**
         * The created at timestamp.
         */
        private LocalDateTime createdAt;

        /**
         * The updated at timestamp.
         */
        private LocalDateTime updatedAt;

        /**
         * Sets the ID.
         *
         * @param id the ID
         * @return this builder
         */
        public BuilderWrapper id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the user ID.
         *
         * @param userId the user ID
         * @return this builder
         */
        public BuilderWrapper userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * Sets the theme.
         *
         * @param theme the theme
         * @return this builder
         */
        public BuilderWrapper theme(String theme) {
            this.theme = theme;
            return this;
        }

        /**
         * Sets the language.
         *
         * @param language the language
         * @return this builder
         */
        public BuilderWrapper language(String language) {
            this.language = language;
            return this;
        }

        /**
         * Sets the timezone.
         *
         * @param timezone the timezone
         * @return this builder
         */
        public BuilderWrapper timezone(String timezone) {
            this.timezone = timezone;
            return this;
        }

        /**
         * Sets the notification config.
         *
         * @param notificationConfig the notification config
         * @return this builder
         */
        public BuilderWrapper notificationConfig(NotificationConfig notificationConfig) {
            this.notificationConfig = copyNotificationConfig(notificationConfig);
            return this;
        }

        /**
         * Sets the trading config.
         *
         * @param tradingConfig the trading config
         * @return this builder
         */
        public BuilderWrapper tradingConfig(TradingConfig tradingConfig) {
            this.tradingConfig = copyTradingConfig(tradingConfig);
            return this;
        }

        /**
         * Sets the display config.
         *
         * @param displayConfig the display config
         * @return this builder
         */
        public BuilderWrapper displayConfig(DisplayConfig displayConfig) {
            this.displayConfig = copyDisplayConfig(displayConfig);
            return this;
        }

        /**
         * Sets the quick links.
         *
         * @param quickLinks the quick links
         * @return this builder
         */
        public BuilderWrapper quickLinks(List<QuickLink> quickLinks) {
            this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
            return this;
        }

        /**
         * Sets the LLM config.
         *
         * @param llmConfig the LLM config
         * @return this builder
         */
        public BuilderWrapper llmConfig(LlmConfig llmConfig) {
            this.llmConfig = copyLlmConfig(llmConfig);
            return this;
        }

        /**
         * Sets the created at.
         *
         * @param createdAt the created at
         * @return this builder
         */
        public BuilderWrapper createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Sets the updated at.
         *
         * @param updatedAt the updated at
         * @return this builder
         */
        public BuilderWrapper updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * Builds the UserSettings.
         *
         * @return the UserSettings
         */
        public UserSettings build() {
            UserSettings settings = new UserSettings();
            settings.id = id;
            settings.setUserId(userId);
            settings.setTheme(theme);
            settings.setLanguage(language);
            settings.setTimezone(timezone);
            settings.setNotificationConfig(notificationConfig);
            settings.setTradingConfig(tradingConfig);
            settings.setDisplayConfig(displayConfig);
            settings.setQuickLinks(quickLinks);
            settings.setLlmConfig(llmConfig);
            settings.createdAt = createdAt;
            settings.setUpdatedAt(updatedAt);
            return settings;
        }
    }

    /**
     * Notification configuration.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class NotificationConfig {

        /**
         * Email notification enabled.
         */
        @Builder.Default
        private Boolean email = true;

        /**
         * Browser notification enabled.
         */
        @Builder.Default
        private Boolean browser = true;

        /**
         * Price alert enabled.
         */
        @Builder.Default
        private Boolean priceAlert = true;

        /**
         * Trade alert enabled.
         */
        @Builder.Default
        private Boolean tradeAlert = true;

        /**
         * Strategy alert enabled.
         */
        @Builder.Default
        private Boolean strategyAlert = true;
    }

    /**
     * Trading configuration.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class TradingConfig {

        /**
         * Default market.
         */
        @Builder.Default
        private String defaultMarket = "US";

        /**
         * Commission rate constant (0.1%).
         */
        private static final Double DEFAULT_COMMISSION_RATE = 0.001;

        /**
         * Commission rate.
         */
        @Builder.Default
        private Double commissionRate = DEFAULT_COMMISSION_RATE;

        /**
         * Minimum commission.
         */
        @Builder.Default
        private Double minCommission = 0.0;

        /**
         * Enable confirmation.
         */
        @Builder.Default
        private Boolean enableConfirmation = true;
    }

    /**
     * Display configuration.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class DisplayConfig {

        /**
         * Currency.
         */
        @Builder.Default
        private String currency = "USD";

        /**
         * Date format.
         */
        @Builder.Default
        private String dateFormat = "YYYY-MM-DD";

        /**
         * Number format.
         */
        @Builder.Default
        private String numberFormat = "comma";

        /**
         * Compact mode.
         */
        @Builder.Default
        private Boolean compactMode = false;
    }

    /**
     * Quick link.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class QuickLink {

        /**
         * Link ID.
         */
        private Long id;

        /**
         * Link name.
         */
        private String name;

        /**
         * Link icon.
         */
        private String icon;

        /**
         * Link path.
         */
        private String path;

        /**
         * Sort order.
         */
        private Integer sortOrder;
    }

    /**
     * LLM configuration.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class LlmConfig {

        /**
         * Provider name.
         */
        private String provider;

        /**
         * API key.
         */
        private String apiKey;

        /**
         * API base URL.
         */
        private String apiBase;

        /**
         * Minimax config.
         */
        private ProviderConfig minimax;

        /**
         * Deepseek config.
         */
        private ProviderConfig deepseek;

        /**
         * OpenAI config.
         */
        private ProviderConfig openai;

        /**
         * Memory config.
         */
        @Builder.Default
        private MemoryConfig memory = new MemoryConfig();

        /**
         * Gets minimax config copy.
         *
         * @return minimax config copy
         */
        public ProviderConfig getMinimax() {
            return copyProviderConfig(minimax);
        }

        /**
         * Sets minimax config with copy.
         *
         * @param minimax the minimax config
         */
        public void setMinimax(ProviderConfig minimax) {
            this.minimax = copyProviderConfig(minimax);
        }

        /**
         * Gets deepseek config copy.
         *
         * @return deepseek config copy
         */
        public ProviderConfig getDeepseek() {
            return copyProviderConfig(deepseek);
        }

        /**
         * Sets deepseek config with copy.
         *
         * @param deepseek the deepseek config
         */
        public void setDeepseek(ProviderConfig deepseek) {
            this.deepseek = copyProviderConfig(deepseek);
        }

        /**
         * Gets openai config copy.
         *
         * @return openai config copy
         */
        public ProviderConfig getOpenai() {
            return copyProviderConfig(openai);
        }

        /**
         * Sets openai config with copy.
         *
         * @param openai the openai config
         */
        public void setOpenai(ProviderConfig openai) {
            this.openai = copyProviderConfig(openai);
        }

        /**
         * Gets memory config copy.
         *
         * @return memory config copy
         */
        public MemoryConfig getMemory() {
            return copyMemoryConfig(memory);
        }

        /**
         * Sets memory config with copy.
         *
         * @param memory the memory config
         */
        public void setMemory(MemoryConfig memory) {
            this.memory = copyMemoryConfig(memory);
        }
    }

    /**
     * Provider configuration.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class ProviderConfig {

        /**
         * API key.
         */
        private String apiKey;

        /**
         * API base URL.
         */
        private String apiBase;
    }

    /**
     * Memory configuration.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class MemoryConfig {

        /**
         * Memory enabled.
         */
        @Builder.Default
        private Boolean enabled = true;

        /**
         * Memory mode.
         */
        @Builder.Default
        private String mode = "L0";

        /**
         * Enable L1.
         */
        @Builder.Default
        private Boolean enableL1 = true;

        /**
         * Enable L2.
         */
        @Builder.Default
        private Boolean enableL2 = true;

        /**
         * Enable L3.
         */
        @Builder.Default
        private Boolean enableL3 = true;
    }
}
