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
public class UpdateSignalRequest {

    @Size(max = 2000, message = "推荐理由最多 2000 个字符")
    private String reason;

    @DecimalMin(value = "0.0001", message = "目标价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "目标价格格式不正确")
    private BigDecimal targetPrice;

    @DecimalMin(value = "0.0001", message = "止损价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "止损价格格式不正确")
    private BigDecimal stopLoss;

    @Min(value = 0, message = "信心指数最小为 0")
    @Max(value = 100, message = "信心指数最大为 100")
    private Integer confidence;

    @Pattern(regexp = "ACTIVE|CLOSED|CANCELLED", message = "状态必须是 ACTIVE, CLOSED 或 CANCELLED")
    private String status;

    private List<String> tags;
}
