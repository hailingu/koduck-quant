package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 更新通知设置请求 DTO。
 *
 * @author GitHub Copilot
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateNotificationRequest {

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
