package com.koduck.dto.ai;

import jakarta.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 风险评估请求 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskAssessmentRequest {

    /**
     * 投资组合ID。
     */
    @NotNull(message = "投资组合ID不能为空")
    private Long portfolioId;
}
