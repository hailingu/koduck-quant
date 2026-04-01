package com.koduck.entity;

import com.koduck.util.CollectionCopyUtils;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Setter;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * 用户个性化设置实体。
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Entity
@Table(name = "user_settings")
@Data
@NoArgsConstructor
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "theme", nullable = false, length = 20)
    private String theme = "light";

    @Column(name = "language", nullable = false, length = 10)
    private String language = "zh-CN";

    @Column(name = "timezone", nullable = false, length = 50)
    private String timezone = "Asia/Shanghai";

    @Column(name = "notification_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private NotificationConfig notificationConfig = new NotificationConfig();

    @Column(name = "trading_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private TradingConfig tradingConfig = new TradingConfig();

    @Column(name = "display_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private DisplayConfig displayConfig = new DisplayConfig();

    @Column(name = "quick_links", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<QuickLink> quickLinks = List.of();

    @Column(name = "llm_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private LlmConfig llmConfig = new LlmConfig();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public static BuilderWrapper builder() {
        return new BuilderWrapper();
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
        return source.toBuilder().build();
    }

    private static TradingConfig copyTradingConfig(TradingConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    private static DisplayConfig copyDisplayConfig(DisplayConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
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
        return source.toBuilder().build();
    }

    private static MemoryConfig copyMemoryConfig(MemoryConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    public static final class BuilderWrapper {

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

        public BuilderWrapper id(Long id) {
            this.id = id;
            return this;
        }

        public BuilderWrapper userId(Long userId) {
            this.userId = userId;
            return this;
        }

        public BuilderWrapper theme(String theme) {
            this.theme = theme;
            return this;
        }

        public BuilderWrapper language(String language) {
            this.language = language;
            return this;
        }

        public BuilderWrapper timezone(String timezone) {
            this.timezone = timezone;
            return this;
        }

        public BuilderWrapper notificationConfig(NotificationConfig notificationConfig) {
            this.notificationConfig = copyNotificationConfig(notificationConfig);
            return this;
        }

        public BuilderWrapper tradingConfig(TradingConfig tradingConfig) {
            this.tradingConfig = copyTradingConfig(tradingConfig);
            return this;
        }

        public BuilderWrapper displayConfig(DisplayConfig displayConfig) {
            this.displayConfig = copyDisplayConfig(displayConfig);
            return this;
        }

        public BuilderWrapper quickLinks(List<QuickLink> quickLinks) {
            this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
            return this;
        }

        public BuilderWrapper llmConfig(LlmConfig llmConfig) {
            this.llmConfig = copyLlmConfig(llmConfig);
            return this;
        }

        public BuilderWrapper createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public BuilderWrapper updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

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

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class NotificationConfig {

        @Builder.Default
        private Boolean email = true;

        @Builder.Default
        private Boolean browser = true;

        @Builder.Default
        private Boolean priceAlert = true;

        @Builder.Default
        private Boolean tradeAlert = true;

        @Builder.Default
        private Boolean strategyAlert = true;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class TradingConfig {

        @Builder.Default
        private String defaultMarket = "US";

        @Builder.Default
        private Double commissionRate = 0.001;

        @Builder.Default
        private Double minCommission = 0.0;

        @Builder.Default
        private Boolean enableConfirmation = true;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class DisplayConfig {

        @Builder.Default
        private String currency = "USD";

        @Builder.Default
        private String dateFormat = "YYYY-MM-DD";

        @Builder.Default
        private String numberFormat = "comma";

        @Builder.Default
        private Boolean compactMode = false;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class QuickLink {

        private Long id;

        private String name;

        private String icon;

        private String path;

        private Integer sortOrder;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class LlmConfig {

        private String provider;

        private String apiKey;

        private String apiBase;

        private ProviderConfig minimax;

        private ProviderConfig deepseek;

        private ProviderConfig openai;

        @Builder.Default
        private MemoryConfig memory = new MemoryConfig();

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
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class ProviderConfig {

        private String apiKey;

        private String apiBase;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class MemoryConfig {

        @Builder.Default
        private Boolean enabled = true;

        @Builder.Default
        private String mode = "L0";

        @Builder.Default
        private Boolean enableL1 = true;

        @Builder.Default
        private Boolean enableL2 = true;

        @Builder.Default
        private Boolean enableL3 = true;
    }
}