package com.koduck.dto.backtest;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Backtest trade DTO.
 */
public record BacktestTradeDto(
    Long id,
    String tradeType,
    LocalDateTime tradeTime,
    String symbol,
    BigDecimal price,
    BigDecimal quantity,
    BigDecimal amount,
    BigDecimal commission,
    BigDecimal slippageCost,
    BigDecimal totalCost,
    BigDecimal cashAfter,
    BigDecimal positionAfter,
    BigDecimal pnl,
    BigDecimal pnlPercent,
    String signalReason
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        private Long id;
        private String tradeType;
        private LocalDateTime tradeTime;
        private String symbol;
        private BigDecimal price;
        private BigDecimal quantity;
        private BigDecimal amount;
        private BigDecimal commission;
        private BigDecimal slippageCost;
        private BigDecimal totalCost;
        private BigDecimal cashAfter;
        private BigDecimal positionAfter;
        private BigDecimal pnl;
        private BigDecimal pnlPercent;
        private String signalReason;
        
        public Builder id(Long id) { this.id = id; return this; }
        public Builder tradeType(String tradeType) { this.tradeType = tradeType; return this; }
        public Builder tradeTime(LocalDateTime tradeTime) { this.tradeTime = tradeTime; return this; }
        public Builder symbol(String symbol) { this.symbol = symbol; return this; }
        public Builder price(BigDecimal price) { this.price = price; return this; }
        public Builder quantity(BigDecimal quantity) { this.quantity = quantity; return this; }
        public Builder amount(BigDecimal amount) { this.amount = amount; return this; }
        public Builder commission(BigDecimal commission) { this.commission = commission; return this; }
        public Builder slippageCost(BigDecimal slippageCost) { this.slippageCost = slippageCost; return this; }
        public Builder totalCost(BigDecimal totalCost) { this.totalCost = totalCost; return this; }
        public Builder cashAfter(BigDecimal cashAfter) { this.cashAfter = cashAfter; return this; }
        public Builder positionAfter(BigDecimal positionAfter) { this.positionAfter = positionAfter; return this; }
        public Builder pnl(BigDecimal pnl) { this.pnl = pnl; return this; }
        public Builder pnlPercent(BigDecimal pnlPercent) { this.pnlPercent = pnlPercent; return this; }
        public Builder signalReason(String signalReason) { this.signalReason = signalReason; return this; }
        
        public BacktestTradeDto build() {
            return new BacktestTradeDto(id, tradeType, tradeTime, symbol, price, quantity, amount,
                    commission, slippageCost, totalCost, cashAfter, positionAfter, pnl, pnlPercent, signalReason);
        }
    }
}
