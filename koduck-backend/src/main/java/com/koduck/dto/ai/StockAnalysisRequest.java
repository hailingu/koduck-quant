package com.koduck.dto.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockAnalysisRequest {

    @NotBlank(message = "股票代码不能为空")
    private String symbol;

    private String market;

    @Pattern(regexp = "technical|fundamental|sentiment|comprehensive", 
             message = "分析类型必须是 technical、fundamental、sentiment 或 comprehensive")
    private String analysisType;
    
    // 
    private String name;
    private Double price;
    private Double changePercent;
    private Double openPrice;
    private Double high;
    private Double low;
    private Double prevClose;
    private Long volume;
    private Double amount;
    private String question;
    private String provider;
}
