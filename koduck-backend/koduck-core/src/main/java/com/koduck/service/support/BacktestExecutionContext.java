package com.koduck.service.support;

import java.math.BigDecimal;

/**
 * 运行中回测模拟的可变执行上下文。
 *
 * @author GitHub Copilot
 */
public class BacktestExecutionContext {

    /**
     * 可用交易现金。
     */
    private BigDecimal cash;

    /**
     * 当前持仓数量。
     */
    private BigDecimal position;

    /**
     * 当前持仓的入场价格。
     */
    private BigDecimal entryPrice;

    /**
     * 交易佣金率。
     */
    private final BigDecimal commissionRate;

    /**
     * 交易执行的滑点因子。
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
