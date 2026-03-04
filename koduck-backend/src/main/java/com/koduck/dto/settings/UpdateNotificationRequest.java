package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 更新通知设置请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateNotificationRequest {

    private Boolean email;
    private Boolean browser;
    private Boolean priceAlert;
    private Boolean tradeAlert;
    private Boolean strategyAlert;
}
