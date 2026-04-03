package com.koduck.service.support;

import java.math.BigDecimal;

/**
 * Mutable execution context for a running backtest simulation.
 *
 * @author GitHub Copilot
 */
public class BacktestExecutionContext {

    /**
     * Available cash for trading.
     */
    private BigDecimal cash;

    /**
     * Current position size.
     */
    private BigDecimal position;

    /**
     * Entry price of current position.
     */
    private BigDecimal entryPrice;

    /**
     * Commission rate for trades.
     */
    private final BigDecimal commissionRate;

    /**
     * Slippage factor for trade execution.
     */
    private final BigDecimal slippage;

    public BacktestExecutionContext(BigDecimal initialCapital, BigDecimal commissionRate, BigDecimal slippage) {
        this.cash = initialCapital;
        this.position = BigDecimal.ZERO;
        this.entryPrice = BigDecimal.ZERO;
        this.commissionRate = commissionRate;
        this.slippage = slippage;
    }

    public BigDecimal getCash() {
        return cash;
    }

    public void setCash(BigDecimal cash) {
        this.cash = cash;
    }

    public BigDecimal getPosition() {
        return position;
    }

    public void setPosition(BigDecimal position) {
        this.position = position;
    }

    public BigDecimal getEntryPrice() {
        return entryPrice;
    }

    public void setEntryPrice(BigDecimal entryPrice) {
        this.entryPrice = entryPrice;
    }

    public BigDecimal getCommissionRate() {
        return commissionRate;
    }

    public BigDecimal getSlippage() {
        return slippage;
    }
}
