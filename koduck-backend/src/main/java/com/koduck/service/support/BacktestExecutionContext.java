package com.koduck.service.support;

import java.math.BigDecimal;

/**
 * Mutable execution context for a running backtest simulation.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
public class BacktestExecutionContext {

    private BigDecimal cash;

    private BigDecimal position;

    private BigDecimal entryPrice;

    private final BigDecimal commissionRate;

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
