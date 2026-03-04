package com.koduck.dto.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 股票分析请求 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockAnalysisRequest {

    @NotBlank(message = "股票代码不能为空")
    private String symbol;

    @NotBlank(message = "市场不能为空")
    @Pattern(regexp = "US|SH|SZ|HK", message = "市场必须是 US、SH、SZ 或 HK")
    private String market;

    @Pattern(regexp = "technical|fundamental|sentiment|comprehensive", 
             message = "分析类型必须是 technical、fundamental、sentiment 或 comprehensive")
    private String analysisType;
}
