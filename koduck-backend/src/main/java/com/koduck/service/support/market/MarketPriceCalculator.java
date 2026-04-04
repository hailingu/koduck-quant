package com.koduck.service.support.market;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

/**
 * Calculator for market price changes and percentage changes.
 *
 * @author Koduck Team
 */
@Component
public class MarketPriceCalculator {

    /** Scale used for division operations. */
    private static final int DIVIDE_SCALE = 4;

    /** Multiplier to convert a ratio to a percentage. */
    private static final int PERCENTAGE_MULTIPLIER = 100;

    /**
     * Calculates the absolute price change.
     *
     * @param price     the current price
     * @param prevClose the previous closing price
     * @return the change amount, or {@code null} if either input is null
     */
    public BigDecimal calculateChange(BigDecimal price, BigDecimal prevClose) {
        if (price == null || prevClose == null) {
            return null;
        }
        return price.subtract(prevClose);
    }

    /**
     * Calculates the percentage change given the absolute change and previous
     * closing price.
     *
     * @param change    the absolute change
     * @param prevClose the previous closing price
     * @return the percentage change, or {@code null} if inputs are invalid or
     *         {@code prevClose} is zero
     */
    public BigDecimal calculateChangePercent(BigDecimal change, BigDecimal prevClose) {
        if (change == null || prevClose == null
                || BigDecimal.ZERO.compareTo(prevClose) == 0) {
            return null;
        }
        return change.multiply(BigDecimal.valueOf(PERCENTAGE_MULTIPLIER))
                .divide(prevClose, DIVIDE_SCALE, RoundingMode.HALF_UP);
    }
}
