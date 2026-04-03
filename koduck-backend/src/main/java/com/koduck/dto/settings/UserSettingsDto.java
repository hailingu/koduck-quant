package com.koduck.dto.settings;

import java.time.LocalDateTime;
import java.util.List;

import com.koduck.util.CollectionCopyUtils;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


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
}
