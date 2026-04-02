package com.koduck.dto.settings;

import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.koduck.util.CollectionCopyUtils;

/**
 * 用户设置响应 DTO。
 *
 * @author GitHub Copilot
 */
@Data
@NoArgsConstructor
public class UserSettingsDto {

    /** 设置ID. */
    private Long id;

    /** 用户ID. */
    private Long userId;

    /** 主题. */
    private String theme;

    /** 语言. */
    private String language;

    /** 时区. */
    private String timezone;

    /** 通知配置. */
    private NotificationConfigDto notification;

    /** 交易配置. */
    private TradingConfigDto trading;

    /** 显示配置. */
    private DisplayConfigDto display;

    /** 快速链接列表. */
    private List<QuickLinkDto> quickLinks;

    /** LLM配置. */
    private LlmConfigDto llmConfig;

    /** 创建时间. */
    private LocalDateTime createdAt;

    /** 更新时间. */
    private LocalDateTime updatedAt;

    /**
     * 创建 BuilderWrapper 实例。
     *
     * @return BuilderWrapper 实例
     */
    public static BuilderWrapper builder() {
        return new BuilderWrapper();
    }

    /**
     * 获取通知配置（深拷贝）。
     *
     * @return 通知配置
     */
    public NotificationConfigDto getNotification() {
        return copyNotification(notification);
    }

    /**
     * 设置通知配置（深拷贝）。
     *
     * @param notification 通知配置
     */
    public void setNotification(NotificationConfigDto notification) {
        this.notification = copyNotification(notification);
    }

    /**
     * 获取交易配置（深拷贝）。
     *
     * @return 交易配置
     */
    public TradingConfigDto getTrading() {
        return copyTrading(trading);
    }

    /**
     * 设置交易配置（深拷贝）。
     *
     * @param trading 交易配置
     */
    public void setTrading(TradingConfigDto trading) {
        this.trading = copyTrading(trading);
    }

    /**
     * 获取显示配置（深拷贝）。
     *
     * @return 显示配置
     */
    public DisplayConfigDto getDisplay() {
        return copyDisplay(display);
    }

    /**
     * 设置显示配置（深拷贝）。
     *
     * @param display 显示配置
     */
    public void setDisplay(DisplayConfigDto display) {
        this.display = copyDisplay(display);
    }

    /**
     * 获取快速链接列表（深拷贝）。
     *
     * @return 快速链接列表
     */
    public List<QuickLinkDto> getQuickLinks() {
        return CollectionCopyUtils.copyList(quickLinks);
    }

    /**
     * 设置快速链接列表（深拷贝）。
     *
     * @param quickLinks 快速链接列表
     */
    public void setQuickLinks(List<QuickLinkDto> quickLinks) {
        this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
    }

    /**
     * 获取LLM配置（深拷贝）。
     *
     * @return LLM配置
     */
    public LlmConfigDto getLlmConfig() {
        return copyLlmConfig(llmConfig);
    }

    /**
     * 设置LLM配置（深拷贝）。
     *
     * @param llmConfig LLM配置
     */
    public void setLlmConfig(LlmConfigDto llmConfig) {
        this.llmConfig = copyLlmConfig(llmConfig);
    }

    /**
     * 深拷贝通知配置。
     *
     * @param source 源配置
     * @return 拷贝后的配置
     */
    private static NotificationConfigDto copyNotification(NotificationConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * 深拷贝交易配置。
     *
     * @param source 源配置
     * @return 拷贝后的配置
     */
    private static TradingConfigDto copyTrading(TradingConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * 深拷贝显示配置。
     *
     * @param source 源配置
     * @return 拷贝后的配置
     */
    private static DisplayConfigDto copyDisplay(DisplayConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * 深拷贝LLM配置。
     *
     * @param source 源配置
     * @return 拷贝后的配置
     */
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

    /**
     * 深拷贝提供商配置。
     *
     * @param source 源配置
     * @return 拷贝后的配置
     */
    private static ProviderConfigDto copyProviderConfig(ProviderConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * 深拷贝内存配置。
     *
     * @param source 源配置
     * @return 拷贝后的配置
     */
    private static MemoryConfigDto copyMemoryConfig(MemoryConfigDto source) {
        if (source == null) {
            return null;
        }
        return source.toBuilder().build();
    }

    /**
     * Builder 包装类。
     */
    public static final class BuilderWrapper {

        /** 设置ID. */
        private Long id;

        /** 用户ID. */
        private Long userId;

        /** 主题. */
        private String theme;

        /** 语言. */
        private String language;

        /** 时区. */
        private String timezone;

        /** 通知配置. */
        private NotificationConfigDto notification;

        /** 交易配置. */
        private TradingConfigDto trading;

        /** 显示配置. */
        private DisplayConfigDto display;

        /** 快速链接列表. */
        private List<QuickLinkDto> quickLinks;

        /** LLM配置. */
        private LlmConfigDto llmConfig;

        /** 创建时间. */
        private LocalDateTime createdAt;

        /** 更新时间. */
        private LocalDateTime updatedAt;

        /**
         * 设置ID。
         *
         * @param id 设置ID
         * @return BuilderWrapper
         */
        public BuilderWrapper id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置用户ID。
         *
         * @param userId 用户ID
         * @return BuilderWrapper
         */
        public BuilderWrapper userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * 设置主题。
         *
         * @param theme 主题
         * @return BuilderWrapper
         */
        public BuilderWrapper theme(String theme) {
            this.theme = theme;
            return this;
        }

        /**
         * 设置语言。
         *
         * @param language 语言
         * @return BuilderWrapper
         */
        public BuilderWrapper language(String language) {
            this.language = language;
            return this;
        }

        /**
         * 设置时区。
         *
         * @param timezone 时区
         * @return BuilderWrapper
         */
        public BuilderWrapper timezone(String timezone) {
            this.timezone = timezone;
            return this;
        }

        /**
         * 设置通知配置。
         *
         * @param notification 通知配置
         * @return BuilderWrapper
         */
        public BuilderWrapper notification(NotificationConfigDto notification) {
            this.notification = copyNotification(notification);
            return this;
        }

        /**
         * 设置交易配置。
         *
         * @param trading 交易配置
         * @return BuilderWrapper
         */
        public BuilderWrapper trading(TradingConfigDto trading) {
            this.trading = copyTrading(trading);
            return this;
        }

        /**
         * 设置显示配置。
         *
         * @param display 显示配置
         * @return BuilderWrapper
         */
        public BuilderWrapper display(DisplayConfigDto display) {
            this.display = copyDisplay(display);
            return this;
        }

        /**
         * 设置快速链接列表。
         *
         * @param quickLinks 快速链接列表
         * @return BuilderWrapper
         */
        public BuilderWrapper quickLinks(List<QuickLinkDto> quickLinks) {
            this.quickLinks = CollectionCopyUtils.copyList(quickLinks);
            return this;
        }

        /**
         * 设置LLM配置。
         *
         * @param llmConfig LLM配置
         * @return BuilderWrapper
         */
        public BuilderWrapper llmConfig(LlmConfigDto llmConfig) {
            this.llmConfig = copyLlmConfig(llmConfig);
            return this;
        }

        /**
         * 设置创建时间。
         *
         * @param createdAt 创建时间
         * @return BuilderWrapper
         */
        public BuilderWrapper createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * 设置更新时间。
         *
         * @param updatedAt 更新时间
         * @return BuilderWrapper
         */
        public BuilderWrapper updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * 构建 UserSettingsDto 实例。
         *
         * @return UserSettingsDto 实例
         */
        public UserSettingsDto build() {
            UserSettingsDto dto = new UserSettingsDto();
            dto.setId(id);
            dto.setUserId(userId);
            dto.setTheme(theme);
            dto.setLanguage(language);
            dto.setTimezone(timezone);
            dto.setNotification(notification);
            dto.setTrading(trading);
            dto.setDisplay(display);
            dto.setQuickLinks(quickLinks);
            dto.setLlmConfig(llmConfig);
            dto.setCreatedAt(createdAt);
            dto.setUpdatedAt(updatedAt);
            return dto;
        }
    }

    /**
     * 通知配置 DTO。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class NotificationConfigDto {

        /** 邮件通知开关. */
        private Boolean email;

        /** 浏览器通知开关. */
        private Boolean browser;

        /** 价格提醒开关. */
        private Boolean priceAlert;

        /** 交易提醒开关. */
        private Boolean tradeAlert;

        /** 策略提醒开关. */
        private Boolean strategyAlert;
    }

    /**
     * 交易配置 DTO。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class TradingConfigDto {

        /** 默认市场. */
        private String defaultMarket;

        /** 佣金费率. */
        private Double commissionRate;

        /** 最低佣金. */
        private Double minCommission;

        /** 是否启用确认. */
        private Boolean enableConfirmation;
    }

    /**
     * 显示配置 DTO。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class DisplayConfigDto {

        /** 货币单位. */
        private String currency;

        /** 日期格式. */
        private String dateFormat;

        /** 数字格式. */
        private String numberFormat;

        /** 是否紧凑模式. */
        private Boolean compactMode;
    }

    /**
     * 快速链接 DTO。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class QuickLinkDto {

        /** 链接ID. */
        private Long id;

        /** 链接名称. */
        private String name;

        /** 图标. */
        private String icon;

        /** 路径. */
        private String path;

        /** 排序号. */
        private Integer sortOrder;
    }

    /**
     * LLM配置 DTO。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class LlmConfigDto {

        /** 提供商. */
        private String provider;

        /** API密钥. */
        private String apiKey;

        /** API基础地址. */
        private String apiBase;

        /** Minimax配置. */
        private ProviderConfigDto minimax;

        /** Deepseek配置. */
        private ProviderConfigDto deepseek;

        /** OpenAI配置. */
        private ProviderConfigDto openai;

        /** 内存配置. */
        private MemoryConfigDto memory;

        /**
         * 获取Minimax配置（深拷贝）。
         *
         * @return Minimax配置
         */
        public ProviderConfigDto getMinimax() {
            return copyProviderConfig(minimax);
        }

        /**
         * 设置Minimax配置（深拷贝）。
         *
         * @param minimax Minimax配置
         */
        public void setMinimax(ProviderConfigDto minimax) {
            this.minimax = copyProviderConfig(minimax);
        }

        /**
         * 获取Deepseek配置（深拷贝）。
         *
         * @return Deepseek配置
         */
        public ProviderConfigDto getDeepseek() {
            return copyProviderConfig(deepseek);
        }

        /**
         * 设置Deepseek配置（深拷贝）。
         *
         * @param deepseek Deepseek配置
         */
        public void setDeepseek(ProviderConfigDto deepseek) {
            this.deepseek = copyProviderConfig(deepseek);
        }

        /**
         * 获取OpenAI配置（深拷贝）。
         *
         * @return OpenAI配置
         */
        public ProviderConfigDto getOpenai() {
            return copyProviderConfig(openai);
        }

        /**
         * 设置OpenAI配置（深拷贝）。
         *
         * @param openai OpenAI配置
         */
        public void setOpenai(ProviderConfigDto openai) {
            this.openai = copyProviderConfig(openai);
        }

        /**
         * 获取内存配置（深拷贝）。
         *
         * @return 内存配置
         */
        public MemoryConfigDto getMemory() {
            return copyMemoryConfig(memory);
        }

        /**
         * 设置内存配置（深拷贝）。
         *
         * @param memory 内存配置
         */
        public void setMemory(MemoryConfigDto memory) {
            this.memory = copyMemoryConfig(memory);
        }
    }

    /**
     * 提供商配置 DTO。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class ProviderConfigDto {

        /** API密钥. */
        private String apiKey;

        /** API基础地址. */
        private String apiBase;
    }

    /**
     * 内存配置 DTO。
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder(toBuilder = true)
    public static class MemoryConfigDto {

        /** 是否启用. */
        private Boolean enabled;

        /** 模式. */
        private String mode;

        /** 是否启用L1. */
        private Boolean enableL1;

        /** 是否启用L2. */
        private Boolean enableL2;

        /** 是否启用L3. */
        private Boolean enableL3;
    }
}
