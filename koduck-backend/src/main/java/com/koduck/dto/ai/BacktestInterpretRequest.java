package com.koduck.dto.ai;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 回测结果解读请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BacktestInterpretRequest {

    @NotNull(message = "回测结果ID不能为空")
    private Long backtestResultId;
}
