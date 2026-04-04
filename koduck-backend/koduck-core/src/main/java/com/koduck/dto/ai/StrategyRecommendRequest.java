package com.koduck.dto.ai;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 策略推荐请求 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StrategyRecommendRequest {

    /**
     * 投资组合ID。
     */
    private Long portfolioId;

    /**
     * 风险偏好。
     */
    @NotNull(message = "风险偏好不能为空")
    @Pattern(
        regexp = "conservative|moderate|aggressive",
        message = "风险偏好必须是 conservative、moderate 或 aggressive"
    )
    private String riskPreference;

    /**
     * 投资期限。
     */
    @Pattern(
        regexp = "short|medium|long",
        message = "投资期限必须是 short、medium 或 long"
    )
    private String investmentHorizon;

    /**
     * 偏好市场。
     */
    private String preferredMarket;
}
