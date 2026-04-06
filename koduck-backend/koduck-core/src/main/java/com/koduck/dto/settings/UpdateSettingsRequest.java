package com.koduck.dto.settings;

import java.util.List;

import jakarta.validation.Valid;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 用户设置更新请求 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSettingsRequest {

    /** 主题. */
    private String theme;

    /** 语言. */
    private String language;

    /** 时区. */
    private String timezone;

    /** 是否启用通知. */
    private Boolean notificationEnabled;

    /** 关注的品种列表. */
    private List<@Valid String> watchlist;

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
}
