package com.koduck.dto.ai;

import jakarta.validation.constraints.NotNull;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 回测解读请求 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BacktestInterpretRequest {

    /**
     * 回测结果ID。
     */
    @NotNull(message = "回测结果ID不能为空")
    private Long backtestResultId;
}
