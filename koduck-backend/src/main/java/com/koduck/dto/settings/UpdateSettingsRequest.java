package com.koduck.dto.settings;

import java.util.List;

import jakarta.validation.Valid;
import lombok.Data;
import lombok.NoArgsConstructor;


/**
 * 用户设置更新请求 DTO。
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
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
}
