package com.koduck.dto.settings;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 交易配置 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TradingConfigDto {

    /** 默认订单类型. */
    private String defaultOrderType;

    /** 默认数量. */
    private Integer defaultQuantity;

    /** 风险提示启用状态. */
    private Boolean riskWarningEnabled;
}
