package com.koduck.dto.settings;

import java.time.LocalDateTime;
import java.util.List;

import lombok.Data;
import lombok.NoArgsConstructor;


/**
 * 用户设置响应 DTO。
 *
 * @author Koduck Team
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

    /** 是否启用通知. */
    private Boolean notificationEnabled;

    /** 创建时间. */
    private LocalDateTime createdAt;

    /** 更新时间. */
    private LocalDateTime updatedAt;

    public List<String> getWatchlist() {
        return CollectionCopyUtils.copyList(watchlist);
    }

    public void setWatchlist(List<String> watchlist) {
        this.watchlist = CollectionCopyUtils.copyList(watchlist);
    }

    /** 关注的品种列表. */
    private List<String> watchlist;
}
