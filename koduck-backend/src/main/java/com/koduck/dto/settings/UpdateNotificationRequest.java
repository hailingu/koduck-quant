package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 *  DTO
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
