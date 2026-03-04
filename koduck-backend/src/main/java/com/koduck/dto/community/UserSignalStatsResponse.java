package com.koduck.dto.community;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 用户信号统计响应 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSignalStatsResponse {

    private Long userId;
    private String username;
    private String avatarUrl;

    private Integer totalSignals;
    private Integer winSignals;
    private Integer lossSignals;
    private BigDecimal winRate;
    private BigDecimal avgProfit;

    private Integer followerCount;
    private Integer reputationScore;
}
