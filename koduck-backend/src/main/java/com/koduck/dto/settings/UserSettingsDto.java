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
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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

    /** 是否启用通知. */
    private Boolean notificationEnabled;

    /** 创建时间. */
    private LocalDateTime createdAt;

    /** 更新时间. */
    private LocalDateTime updatedAt;

    /** 关注的品种列表. */
    private List<String> watchlist;

    /** 通知配置. */
    private NotificationConfigDto notification;

    /** 交易配置. */
    private TradingConfigDto trading;

    /** 显示配置. */
    private DisplayConfigDto display;

    /** LLM 配置. */
    private LlmConfigDto llmConfig;

    /** 快捷链接列表. */
    private List<QuickLinkDto> quickLinks;

    /**
     * 获取关注的品种列表（防御性拷贝）。
     *
     * @return 品种列表
     */
    public List<String> getWatchlist() {
        return CollectionCopyUtils.copyList(watchlist);
    }

    /**
     * 设置关注的品种列表（防御性拷贝）。
     *
     * @param watchlist 品种列表
     */
    public void setWatchlist(List<String> watchlist) {
        this.watchlist = CollectionCopyUtils.copyList(watchlist);
    }

    /**
     * LLM 配置 DTO。
     */
    @Data
    @Builder
    public static class LlmConfigDto {
        /** 提供商. */
        private String provider;
        /** API Key. */
        private String apiKey;
        /** API Base. */
        private String apiBase;
        /** Minimax 配置. */
        private ProviderConfigDto minimax;
        /** Deepseek 配置. */
        private ProviderConfigDto deepseek;
        /** OpenAI 配置. */
        private ProviderConfigDto openai;
        /** 记忆配置. */
        private MemoryConfigDto memory;
    }

    /**
     * 提供商配置 DTO。
     */
    @Data
    @Builder
    public static class ProviderConfigDto {
        /** API Key. */
        private String apiKey;
        /** API Base. */
        private String apiBase;
    }

    /**
     * 记忆配置 DTO。
     */
    @Data
    @Builder
    public static class MemoryConfigDto {
        /** 是否启用. */
        private Boolean enabled;
        /** 模式. */
        private String mode;
        /** 是否启用 L1. */
        private Boolean enableL1;
        /** 是否启用 L2. */
        private Boolean enableL2;
        /** 是否启用 L3. */
        private Boolean enableL3;
    }

    /**
     * 通知配置 DTO。
     */
    @Data
    @Builder
    public static class NotificationConfigDto {
        /** 是否启用邮件通知. */
        private Boolean emailEnabled;
        /** 是否启用推送通知. */
        private Boolean pushEnabled;
        /** 是否启用短信通知. */
        private Boolean smsEnabled;
    }

    /**
     * 交易配置 DTO。
     */
    @Data
    @Builder
    public static class TradingConfigDto {
        /** 默认订单类型. */
        private String defaultOrderType;
        /** 默认数量. */
        private Integer defaultQuantity;
        /** 风险提示启用状态. */
        private Boolean riskWarningEnabled;
    }

    /**
     * 显示配置 DTO。
     */
    @Data
    @Builder
    public static class DisplayConfigDto {
        /** 图表类型. */
        private String chartType;
        /** 时间周期. */
        private String timeFrame;
        /** 是否显示网格. */
        private Boolean showGrid;
    }

    /**
     * 快捷链接 DTO。
     */
    @Data
    @Builder
    public static class QuickLinkDto {
        /** ID. */
        private Long id;
        /** 名称. */
        private String name;
        /** 图标. */
        private String icon;
        /** 路径. */
        private String path;
        /** 排序. */
        private Integer sortOrder;
    }
}
