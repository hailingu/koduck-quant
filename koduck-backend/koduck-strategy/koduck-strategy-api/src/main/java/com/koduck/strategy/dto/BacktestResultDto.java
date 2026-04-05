package com.koduck.strategy.dto;

import lombok.EqualsAndHashCode;
import lombok.ToString;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 回测结果数据传输对象。
 */
@EqualsAndHashCode
@ToString
public class BacktestResultDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private final Long id;
    private final Long strategyId;
    private final String symbol;
    private final String market;
    private final LocalDate startDate;
    private final LocalDate endDate;
    private final BigDecimal initialCapital;
    private final BigDecimal finalCapital;
    private final BigDecimal totalReturn;
    private final BigDecimal annualizedReturn;
    private final BigDecimal maxDrawdown;
    private final BigDecimal sharpeRatio;
    private final Integer totalTrades;
    private final Integer winningTrades;
    private final Integer losingTrades;
    private final BigDecimal winRate;
    private final BigDecimal avgWin;
    private final BigDecimal avgLoss;
    private final BigDecimal profitFactor;
    private final String status;
    private final Instant createdAt;
    private final List<BacktestTradeDto> trades;

    private BacktestResultDto(Builder builder) {
        this.id = builder.id;
        this.strategyId = builder.strategyId;
        this.symbol = builder.symbol;
        this.market = builder.market;
        this.startDate = builder.startDate;
        this.endDate = builder.endDate;
        this.initialCapital = builder.initialCapital;
        this.finalCapital = builder.finalCapital;
        this.totalReturn = builder.totalReturn;
        this.annualizedReturn = builder.annualizedReturn;
        this.maxDrawdown = builder.maxDrawdown;
        this.sharpeRatio = builder.sharpeRatio;
        this.totalTrades = builder.totalTrades;
        this.winningTrades = builder.winningTrades;
        this.losingTrades = builder.losingTrades;
        this.winRate = builder.winRate;
        this.avgWin = builder.avgWin;
        this.avgLoss = builder.avgLoss;
        this.profitFactor = builder.profitFactor;
        this.status = builder.status;
        this.createdAt = builder.createdAt;
        this.trades = builder.trades == null ? null : new ArrayList<>(builder.trades);
    }

    public static Builder builder() {
        return new Builder();
    }

    // Getters
    public Long getId() { return id; }
    public Long getStrategyId() { return strategyId; }
    public String getSymbol() { return symbol; }
    public String getMarket() { return market; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public BigDecimal getInitialCapital() { return initialCapital; }
    public BigDecimal getFinalCapital() { return finalCapital; }
    public BigDecimal getTotalReturn() { return totalReturn; }
    public BigDecimal getAnnualizedReturn() { return annualizedReturn; }
    public BigDecimal getMaxDrawdown() { return maxDrawdown; }
    public BigDecimal getSharpeRatio() { return sharpeRatio; }
    public Integer getTotalTrades() { return totalTrades; }
    public Integer getWinningTrades() { return winningTrades; }
    public Integer getLosingTrades() { return losingTrades; }
    public BigDecimal getWinRate() { return winRate; }
    public BigDecimal getAvgWin() { return avgWin; }
    public BigDecimal getAvgLoss() { return avgLoss; }
    public BigDecimal getProfitFactor() { return profitFactor; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }

    /**
     * 获取交易记录列表的不可修改视图。
     *
     * @return 交易记录列表
     */
    public List<BacktestTradeDto> getTrades() {
        return trades == null ? Collections.emptyList() : List.copyOf(trades);
    }

    /**
     * 构建器。
     */
    public static class Builder {
        private Long id;
        private Long strategyId;
        private String symbol;
        private String market;
        private LocalDate startDate;
        private LocalDate endDate;
        private BigDecimal initialCapital;
        private BigDecimal finalCapital;
        private BigDecimal totalReturn;
        private BigDecimal annualizedReturn;
        private BigDecimal maxDrawdown;
        private BigDecimal sharpeRatio;
        private Integer totalTrades;
        private Integer winningTrades;
        private Integer losingTrades;
        private BigDecimal winRate;
        private BigDecimal avgWin;
        private BigDecimal avgLoss;
        private BigDecimal profitFactor;
        private String status;
        private Instant createdAt;
        private List<BacktestTradeDto> trades;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder strategyId(Long strategyId) { this.strategyId = strategyId; return this; }
        public Builder symbol(String symbol) { this.symbol = symbol; return this; }
        public Builder market(String market) { this.market = market; return this; }
        public Builder startDate(LocalDate startDate) { this.startDate = startDate; return this; }
        public Builder endDate(LocalDate endDate) { this.endDate = endDate; return this; }
        public Builder initialCapital(BigDecimal initialCapital) { this.initialCapital = initialCapital; return this; }
        public Builder finalCapital(BigDecimal finalCapital) { this.finalCapital = finalCapital; return this; }
        public Builder totalReturn(BigDecimal totalReturn) { this.totalReturn = totalReturn; return this; }
        public Builder annualizedReturn(BigDecimal annualizedReturn) { this.annualizedReturn = annualizedReturn; return this; }
        public Builder maxDrawdown(BigDecimal maxDrawdown) { this.maxDrawdown = maxDrawdown; return this; }
        public Builder sharpeRatio(BigDecimal sharpeRatio) { this.sharpeRatio = sharpeRatio; return this; }
        public Builder totalTrades(Integer totalTrades) { this.totalTrades = totalTrades; return this; }
        public Builder winningTrades(Integer winningTrades) { this.winningTrades = winningTrades; return this; }
        public Builder losingTrades(Integer losingTrades) { this.losingTrades = losingTrades; return this; }
        public Builder winRate(BigDecimal winRate) { this.winRate = winRate; return this; }
        public Builder avgWin(BigDecimal avgWin) { this.avgWin = avgWin; return this; }
        public Builder avgLoss(BigDecimal avgLoss) { this.avgLoss = avgLoss; return this; }
        public Builder profitFactor(BigDecimal profitFactor) { this.profitFactor = profitFactor; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }

        public Builder trades(List<BacktestTradeDto> trades) {
            this.trades = trades == null ? null : new ArrayList<>(trades);
            return this;
        }

        public BacktestResultDto build() {
            return new BacktestResultDto(this);
        }
    }

    /**
     * 回测交易记录。
     */
    @EqualsAndHashCode
    @ToString
    public static class BacktestTradeDto implements Serializable {
        private static final long serialVersionUID = 1L;

        private final Long id;
        private final LocalDate date;
        private final String type;
        private final BigDecimal price;
        private final BigDecimal quantity;
        private final BigDecimal amount;
        private final BigDecimal commission;

        private BacktestTradeDto(Builder builder) {
            this.id = builder.id;
            this.date = builder.date;
            this.type = builder.type;
            this.price = builder.price;
            this.quantity = builder.quantity;
            this.amount = builder.amount;
            this.commission = builder.commission;
        }

        public static Builder builder() {
            return new Builder();
        }

        public Long getId() { return id; }
        public LocalDate getDate() { return date; }
        public String getType() { return type; }
        public BigDecimal getPrice() { return price; }
        public BigDecimal getQuantity() { return quantity; }
        public BigDecimal getAmount() { return amount; }
        public BigDecimal getCommission() { return commission; }

        public static class Builder {
            private Long id;
            private LocalDate date;
            private String type;
            private BigDecimal price;
            private BigDecimal quantity;
            private BigDecimal amount;
            private BigDecimal commission;

            public Builder id(Long id) { this.id = id; return this; }
            public Builder date(LocalDate date) { this.date = date; return this; }
            public Builder type(String type) { this.type = type; return this; }
            public Builder price(BigDecimal price) { this.price = price; return this; }
            public Builder quantity(BigDecimal quantity) { this.quantity = quantity; return this; }
            public Builder amount(BigDecimal amount) { this.amount = amount; return this; }
            public Builder commission(BigDecimal commission) { this.commission = commission; return this; }

            public BacktestTradeDto build() {
                return new BacktestTradeDto(this);
            }
        }
    }
}
