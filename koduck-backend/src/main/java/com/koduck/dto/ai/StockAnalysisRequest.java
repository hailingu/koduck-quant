package com.koduck.dto.ai;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 股票分析请求 DTO。
 *
 * @author Koduck Team
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockAnalysisRequest {

    /**
     * 股票代码。
     */
    @NotBlank(message = "股票代码不能为空")
    private String symbol;

    /**
     * 市场。
     */
    private String market;

    /**
     * 分析类型。
     */
    @Pattern(
        regexp = "technical|fundamental|sentiment|comprehensive",
        message = "分析类型必须是 technical、fundamental、sentiment 或 comprehensive"
    )
    private String analysisType;

    /**
     * 股票名称。
     */
    private String name;

    /**
     * 当前价格。
     */
    private Double price;

    /**
     * 涨跌幅。
     */
    private Double changePercent;

    /**
     * 开盘价。
     */
    private Double openPrice;

    /**
     * 最高价。
     */
    private Double high;

    /**
     * 最低价。
     */
    private Double low;

    /**
     * 昨收价。
     */
    private Double prevClose;

    /**
     * 成交量。
     */
    private Long volume;

    /**
     * 成交金额。
     */
    private Double amount;

    /**
     * 用户问题。
     */
    private String question;

    /**
     * 提供商。
     */
    private String provider;
}
