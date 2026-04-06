package com.koduck.strategy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Builder;
import lombok.Value;

import java.io.Serializable;
import java.time.LocalDate;

/**
 * 回测请求数据传输对象。
 *
 * @param strategyId 策略ID
 * @param symbol 股票代码
 * @param market 市场
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @param initialCapital 初始资金
 * @param parameters 回测参数（JSON格式）
 */
@Value
@Builder
public class BacktestRequestDto implements Serializable {
    private static final long serialVersionUID = 1L;

    @NotNull
    @Positive
    Long strategyId;

    @NotBlank
    String symbol;

    @NotBlank
    String market;

    @NotNull
    LocalDate startDate;

    @NotNull
    LocalDate endDate;

    @NotNull
    @Positive
    Double initialCapital;

    String parameters;
}
