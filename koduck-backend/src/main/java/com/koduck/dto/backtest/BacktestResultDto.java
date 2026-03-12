package com.koduck.dto.backtest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Backtest result DTO.
 */
public record BacktestResultDto(
    Long id,
    Long strategyId,
    String strategyName,
    Integer strategyVersion,
    String market,
    String symbol,
    LocalDate startDate,
    LocalDate endDate,
    String timeframe,
    
    // 
    BigDecimal initialCapital,
    BigDecimal commissionRate,
    BigDecimal slippage,
    
    // 
    BigDecimal finalCapital,
    BigDecimal totalReturn,
    BigDecimal annualizedReturn,
    BigDecimal maxDrawdown,
    BigDecimal sharpeRatio,
    
    // 
    Integer totalTrades,
    Integer winningTrades,
    Integer losingTrades,
    BigDecimal winRate,
    BigDecimal avgProfit,
    BigDecimal avgLoss,
    BigDecimal profitFactor,
    
    // 
    String status,
    String errorMessage,
    LocalDateTime createdAt,
    LocalDateTime completedAt
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private Long id;
        private Long strategyId;
        private String strategyName;
        private Integer strategyVersion;
        private String market;
        private String symbol;
        private LocalDate startDate;
        private LocalDate endDate;
        private String timeframe;
        private BigDecimal initialCapital;
        private BigDecimal commissionRate;
        private BigDecimal slippage;
        private BigDecimal finalCapital;
        private BigDecimal totalReturn;
        private BigDecimal annualizedReturn;
        private BigDecimal maxDrawdown;
        private BigDecimal sharpeRatio;
        private Integer totalTrades;
        private Integer winningTrades;
        private Integer losingTrades;
        private BigDecimal winRate;
        private BigDecimal avgProfit;
        private BigDecimal avgLoss;
        private BigDecimal profitFactor;
        private String status;
        private String errorMessage;
        private LocalDateTime createdAt;
        private LocalDateTime completedAt;
        
        public Builder id(Long id) { this.id = id; return this; }
        public Builder strategyId(Long strategyId) { this.strategyId = strategyId; return this; }
        public Builder strategyName(String strategyName) { this.strategyName = strategyName; return this; }
        public Builder strategyVersion(Integer strategyVersion) { this.strategyVersion = strategyVersion; return this; }
        public Builder market(String market) { this.market = market; return this; }
        public Builder symbol(String symbol) { this.symbol = symbol; return this; }
        public Builder startDate(LocalDate startDate) { this.startDate = startDate; return this; }
        public Builder endDate(LocalDate endDate) { this.endDate = endDate; return this; }
        public Builder timeframe(String timeframe) { this.timeframe = timeframe; return this; }
        public Builder initialCapital(BigDecimal initialCapital) { this.initialCapital = initialCapital; return this; }
        public Builder commissionRate(BigDecimal commissionRate) { this.commissionRate = commissionRate; return this; }
        public Builder slippage(BigDecimal slippage) { this.slippage = slippage; return this; }
        public Builder finalCapital(BigDecimal finalCapital) { this.finalCapital = finalCapital; return this; }
        public Builder totalReturn(BigDecimal totalReturn) { this.totalReturn = totalReturn; return this; }
        public Builder annualizedReturn(BigDecimal annualizedReturn) { this.annualizedReturn = annualizedReturn; return this; }
        public Builder maxDrawdown(BigDecimal maxDrawdown) { this.maxDrawdown = maxDrawdown; return this; }
        public Builder sharpeRatio(BigDecimal sharpeRatio) { this.sharpeRatio = sharpeRatio; return this; }
        public Builder totalTrades(Integer totalTrades) { this.totalTrades = totalTrades; return this; }
        public Builder winningTrades(Integer winningTrades) { this.winningTrades = winningTrades; return this; }
        public Builder losingTrades(Integer losingTrades) { this.losingTrades = losingTrades; return this; }
        public Builder winRate(BigDecimal winRate) { this.winRate = winRate; return this; }
        public Builder avgProfit(BigDecimal avgProfit) { this.avgProfit = avgProfit; return this; }
        public Builder avgLoss(BigDecimal avgLoss) { this.avgLoss = avgLoss; return this; }
        public Builder profitFactor(BigDecimal profitFactor) { this.profitFactor = profitFactor; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder errorMessage(String errorMessage) { this.errorMessage = errorMessage; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder completedAt(LocalDateTime completedAt) { this.completedAt = completedAt; return this; }
        
        public BacktestResultDto build() {
            return new BacktestResultDto(id, strategyId, strategyName, strategyVersion, market, symbol,
                    startDate, endDate, timeframe, initialCapital, commissionRate, slippage,
                    finalCapital, totalReturn, annualizedReturn, maxDrawdown, sharpeRatio,
                    totalTrades, winningTrades, losingTrades, winRate, avgProfit, avgLoss,
                    profitFactor, status, errorMessage, createdAt, completedAt);
        }
    }
}
