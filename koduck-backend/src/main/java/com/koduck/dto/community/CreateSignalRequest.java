package com.koduck.dto.community;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSignalRequest {

    @NotNull(message = "策略 ID 不能为空")
    private Long strategyId;

    @NotBlank(message = "股票代码不能为空")
    @Size(max = 20, message = "股票代码最多 20 个字符")
    private String symbol;

    @NotBlank(message = "信号类型不能为空")
    @Pattern(regexp = "BUY|SELL|HOLD", message = "信号类型必须是 BUY, SELL 或 HOLD")
    private String signalType;

    @NotBlank(message = "推荐理由不能为空")
    @Size(max = 2000, message = "推荐理由最多 2000 个字符")
    private String reason;

    @DecimalMin(value = "0.0001", message = "目标价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "目标价格格式不正确")
    private BigDecimal targetPrice;

    @DecimalMin(value = "0.0001", message = "止损价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "止损价格格式不正确")
    private BigDecimal stopLoss;

    @Size(max = 20, message = "时间周期最多 20 个字符")
    private String timeFrame;

    @Min(value = 0, message = "信心指数最小为 0")
    @Max(value = 100, message = "信心指数最大为 100")
    private Integer confidence;

    private List<String> tags;
}
