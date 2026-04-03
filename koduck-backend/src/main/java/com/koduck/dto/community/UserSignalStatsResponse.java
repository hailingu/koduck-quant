package com.koduck.dto.community;

import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * User signal statistics response DTO.
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSignalStatsResponse {

    /** The user ID. */
    private Long userId;

    /** The username. */
    private String username;

    /** The avatar URL. */
    private String avatarUrl;

    /** Total number of signals. */
    private Integer totalSignals;

    /** Number of winning signals. */
    private Integer winSignals;

    /** Number of losing signals. */
    private Integer lossSignals;

    /** Win rate percentage. */
    private BigDecimal winRate;

    /** Average profit percentage. */
    private BigDecimal avgProfit;

    /** Number of followers. */
    private Integer followerCount;

    /** Reputation score. */
    private Integer reputationScore;
}
