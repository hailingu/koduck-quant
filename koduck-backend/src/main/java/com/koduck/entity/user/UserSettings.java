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
 * 用户设置实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "user_settings")
@Data
@NoArgsConstructor
public class UserSettings {

    /**
     * 主键。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 用户 ID。
     */
    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /**
     * 主题设置。
     */
    @Column(name = "theme", nullable = false, length = 20)
    private String theme = "light";

    /**
     * 语言设置。
     */
    @Column(name = "language", nullable = false, length = 10)
    private String language = "zh-CN";

    /**
     * 时区设置。
     */
    @Column(name = "timezone", nullable = false, length = 50)
    private String timezone = "Asia/Shanghai";

    /**
     * 通知配置。
     */
    @Column(name = "notification_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private NotificationConfig notificationConfig = new NotificationConfig();

    /**
     * 交易配置。
     */
    @Column(name = "trading_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private TradingConfig tradingConfig = new TradingConfig();

    /**
     * 显示配置。
     */
    @Column(name = "display_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private DisplayConfig displayConfig = new DisplayConfig();

    /**
     * 快速链接列表。
     */
    @Column(name = "quick_links", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<QuickLink> quickLinks = List.of();

    /**
     * LLM 配置。
     */
    @Column(name = "llm_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private LlmConfig llmConfig = new LlmConfig();

    /**
     * 创建时间。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 更新时间。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 创建新的构建器。
     *
     * @return BuilderWrapper 实例
     */
    public static BuilderWrapper builder() {
        return new BuilderWrapper();
    }

    /**
     * 获取通知配置副本。
     *
     * @return 通知配置副本
     */
    public NotificationConfig getNotificationConfig() {
        return copyNotificationConfig(notificationConfig);
    }

    /**
     * 使用副本设置通知配置。
     *
     * @param notificationConfig 通知配置
     */
    public void setNotificationConfig(NotificationConfig notificationConfig) {
        this.notificationConfig = copyNotificationConfig(notificationConfig);
    }

    /**
     * 获取交易配置副本。
     *
     * @return 交易配置副本
     */
    public TradingConfig getTradingConfig() {
        return copyTradingConfig(tradingConfig);
    }

    /**
     * 使用副本设置交易配置。
     *
     * @param tradingConfig 交易配置
     */
    public void setTradingConfig(TradingConfig tradingConfig) {
        this.tradingConfig = copyTradingConfig(tradingConfig);
    }

    /**
     * 获取显示配置副本。
     *
     * @return 显示配置副本
     */
    public DisplayConfig getDisplayConfig() {
        return copyDisplayConfig(displayConfig);
    }

    /**
     * 使用副本设置显示配置。
     *
     * @param displayConfig 显示配置
     */
    public void setDisplayConfig(DisplayConfig displayConfig) {
        this.displayConfig = copyDisplayConfig(displayConfig);
    }

    /**
     * 获取快速链接副本。
     *
     * @return 快速链接副本
     */
    public List<QuickLink> getQuickLinks() {
        return CollectionCopyUtils.copyList(quickLinks);
    }

    /**
     * 使用副本设置快速链接。
     *
     * @param quickLinks 快速链接
     */
    public void setQuickLinks(List<QuickLink> quickLinks) {
        this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
    }

    /**
     * 获取 LLM 配置副本。
     *
     * @return LLM 配置副本
     */
    public LlmConfig getLlmConfig() {
        return copyLlmConfig(llmConfig);
    }

    /**
     * 使用副本设置 LLM 配置。
     *
     * @param llmConfig LLM 配置
     */
    public void setLlmConfig(LlmConfig llmConfig) {
        this.llmConfig = copyLlmConfig(llmConfig);
    }

    /**
     * 复制通知配置。
     *
     * @param source 源配置
     * @return 复制的配置
     */
    private static NotificationConfig copyNotificationConfig(NotificationConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * 复制交易配置。
     *
     * @param source 源配置
     * @return 复制的配置
     */
    private static TradingConfig copyTradingConfig(TradingConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * 复制显示配置。
     *
     * @param source 源配置
     * @return 复制的配置
     */
    private static DisplayConfig copyDisplayConfig(DisplayConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * 复制 LLM 配置。
     *
     * @param source 源配置
     * @return 复制的配置
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
     * 复制提供商配置。
     *
     * @param source 源配置
     * @return 复制的配置
     */
    private static ProviderConfig copyProviderConfig(ProviderConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * 复制记忆配置。
     *
     * @param source 源配置
     * @return 复制的配置
     */
    private static MemoryConfig copyMemoryConfig(MemoryConfig source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * UserSettings 的构建器包装类。
     */
    public static final class BuilderWrapper {

        /**
         * ID。
         */
        private Long id;

        /**
         * 用户 ID。
         */
        private Long userId;

        /**
         * 主题。
         */
        private String theme;

        /**
         * 语言。
         */
        private String language;

        /**
         * 时区。
         */
        private String timezone;

        /**
         * 通知配置。
         */
        private NotificationConfig notificationConfig;

        /**
         * 交易配置。
         */
        private TradingConfig tradingConfig;

        /**
         * 显示配置。
         */
        private DisplayConfig displayConfig;

        /**
         * 快速链接。
         */
        private List<QuickLink> quickLinks;

        /**
         * LLM 配置。
         */
        private LlmConfig llmConfig;

        /**
         * 创建时间戳。
         */
        private LocalDateTime createdAt;

        /**
         * 更新时间戳。
         */
        private LocalDateTime updatedAt;

        /**
         * 设置 ID。
         *
         * @param id ID
         * @return 此构建器
         */
        public BuilderWrapper id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置用户 ID。
         *
         * @param userId 用户 ID
         * @return 此构建器
         */
        public BuilderWrapper userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * 设置主题。
         *
         * @param theme 主题
         * @return 此构建器
         */
        public BuilderWrapper theme(String theme) {
            this.theme = theme;
            return this;
        }

        /**
         * 设置语言。
         *
         * @param language 语言
         * @return 此构建器
         */
        public BuilderWrapper language(String language) {
            this.language = language;
            return this;
        }

        /**
         * 设置时区。
         *
         * @param timezone 时区
         * @return 此构建器
         */
        public BuilderWrapper timezone(String timezone) {
            this.timezone = timezone;
            return this;
        }

        /**
         * 设置通知配置。
         *
         * @param notificationConfig 通知配置
         * @return 此构建器
         */
        public BuilderWrapper notificationConfig(NotificationConfig notificationConfig) {
            this.notificationConfig = copyNotificationConfig(notificationConfig);
            return this;
        }

        /**
         * 设置交易配置。
         *
         * @param tradingConfig 交易配置
         * @return 此构建器
         */
        public BuilderWrapper tradingConfig(TradingConfig tradingConfig) {
            this.tradingConfig = copyTradingConfig(tradingConfig);
            return this;
        }

        /**
         * 设置显示配置。
         *
         * @param displayConfig 显示配置
         * @return 此构建器
         */
        public BuilderWrapper displayConfig(DisplayConfig displayConfig) {
            this.displayConfig = copyDisplayConfig(displayConfig);
            return this;
        }

        /**
         * 设置快速链接。
         *
         * @param quickLinks 快速链接
         * @return 此构建器
         */
        public BuilderWrapper quickLinks(List<QuickLink> quickLinks) {
            this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
            return this;
        }

        /**
         * 设置 LLM 配置。
         *
         * @param llmConfig LLM 配置
         * @return 此构建器
         */
        public BuilderWrapper llmConfig(LlmConfig llmConfig) {
            this.llmConfig = copyLlmConfig(llmConfig);
            return this;
        }

        /**
         * 设置创建时间。
         *
         * @param createdAt 创建时间
         * @return 此构建器
         */
        public BuilderWrapper createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * 设置更新时间。
         *
         * @param updatedAt 更新时间
         * @return 此构建器
         */
        public BuilderWrapper updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * 构建 UserSettings。
         *
         * @return UserSettings
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
     * 通知配置。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class NotificationConfig {

        /**
         * 邮件通知启用。
         */
        @Builder.Default
        private Boolean email = true;

        /**
         * 浏览器通知启用。
         */
        @Builder.Default
        private Boolean browser = true;

        /**
         * 价格提醒启用。
         */
        @Builder.Default
        private Boolean priceAlert = true;

        /**
         * 交易提醒启用。
         */
        @Builder.Default
        private Boolean tradeAlert = true;

        /**
         * 策略提醒启用。
         */
        @Builder.Default
        private Boolean strategyAlert = true;
    }

    /**
     * 交易配置。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class TradingConfig {

        /**
         * 默认市场。
         */
        @Builder.Default
        private String defaultMarket = "US";

        /**
         * 手续费率常量（0.1%）。
         */
        private static final Double DEFAULT_COMMISSION_RATE = 0.001;

        /**
         * 手续费率。
         */
        @Builder.Default
        private Double commissionRate = DEFAULT_COMMISSION_RATE;

        /**
         * 最低手续费。
         */
        @Builder.Default
        private Double minCommission = 0.0;

        /**
         * 启用确认。
         */
        @Builder.Default
        private Boolean enableConfirmation = true;
    }

    /**
     * 显示配置。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class DisplayConfig {

        /**
         * 货币。
         */
        @Builder.Default
        private String currency = "USD";

        /**
         * 日期格式。
         */
        @Builder.Default
        private String dateFormat = "YYYY-MM-DD";

        /**
         * 数字格式。
         */
        @Builder.Default
        private String numberFormat = "comma";

        /**
         * 紧凑模式。
         */
        @Builder.Default
        private Boolean compactMode = false;
    }

    /**
     * 快速链接。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class QuickLink {

        /**
         * 链接 ID。
         */
        private Long id;

        /**
         * 链接名称。
         */
        private String name;

        /**
         * 链接图标。
         */
        private String icon;

        /**
         * 链接路径。
         */
        private String path;

        /**
         * 排序顺序。
         */
        private Integer sortOrder;
    }

    /**
     * LLM 配置。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class LlmConfig {

        /**
         * 提供商名称。
         */
        private String provider;

        /**
         * API Key。
         */
        private String apiKey;

        /**
         * API 基础 URL。
         */
        private String apiBase;

        /**
         * Minimax 配置。
         */
        private ProviderConfig minimax;

        /**
         * Deepseek 配置。
         */
        private ProviderConfig deepseek;

        /**
         * OpenAI 配置。
         */
        private ProviderConfig openai;

        /**
         * 记忆配置。
         */
        @Builder.Default
        private MemoryConfig memory = new MemoryConfig();

        /**
         * 获取 Minimax 配置副本。
         *
         * @return Minimax 配置副本
         */
        public ProviderConfig getMinimax() {
            return copyProviderConfig(minimax);
        }

        /**
         * 使用副本设置 Minimax 配置。
         *
         * @param minimax Minimax 配置
         */
        public void setMinimax(ProviderConfig minimax) {
            this.minimax = copyProviderConfig(minimax);
        }

        /**
         * 获取 Deepseek 配置副本。
         *
         * @return Deepseek 配置副本
         */
        public ProviderConfig getDeepseek() {
            return copyProviderConfig(deepseek);
        }

        /**
         * 使用副本设置 Deepseek 配置。
         *
         * @param deepseek Deepseek 配置
         */
        public void setDeepseek(ProviderConfig deepseek) {
            this.deepseek = copyProviderConfig(deepseek);
        }

        /**
         * 获取 OpenAI 配置副本。
         *
         * @return OpenAI 配置副本
         */
        public ProviderConfig getOpenai() {
            return copyProviderConfig(openai);
        }

        /**
         * 使用副本设置 OpenAI 配置。
         *
         * @param openai OpenAI 配置
         */
        public void setOpenai(ProviderConfig openai) {
            this.openai = copyProviderConfig(openai);
        }

        /**
         * 获取记忆配置副本。
         *
         * @return 记忆配置副本
         */
        public MemoryConfig getMemory() {
            return copyMemoryConfig(memory);
        }

        /**
         * 使用副本设置记忆配置。
         *
         * @param memory 记忆配置
         */
        public void setMemory(MemoryConfig memory) {
            this.memory = copyMemoryConfig(memory);
        }
    }

    /**
     * 提供商配置。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class ProviderConfig {

        /**
         * API Key。
         */
        private String apiKey;

        /**
         * API 基础 URL。
         */
        private String apiBase;
    }

    /**
     * 记忆配置。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class MemoryConfig {

        /**
         * 记忆启用。
         */
        @Builder.Default
        private Boolean enabled = true;

        /**
         * 记忆模式。
         */
        @Builder.Default
        private String mode = "L0";

        /**
         * 启用 L1。
         */
        @Builder.Default
        private Boolean enableL1 = true;

        /**
         * 启用 L2。
         */
        @Builder.Default
        private Boolean enableL2 = true;

        /**
         * 启用 L3。
         */
        @Builder.Default
        private Boolean enableL3 = true;
    }
}
