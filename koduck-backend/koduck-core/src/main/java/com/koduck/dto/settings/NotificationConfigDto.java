package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 通知配置 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationConfigDto {

    /** 是否启用邮件通知. */
    private Boolean emailEnabled;

    /** 是否启用推送通知. */
    private Boolean pushEnabled;

    /** 是否启用短信通知. */
    private Boolean smsEnabled;
}
