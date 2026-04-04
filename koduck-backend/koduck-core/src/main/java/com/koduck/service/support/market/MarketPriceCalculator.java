package com.koduck.service.support.market;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

/**
 * 市场价格变动和百分比变动计算器。
 *
 * @author Koduck Team
 */
@Component
public class MarketPriceCalculator {

    /** 除法操作使用的小数位数。 */
    private static final int DIVIDE_SCALE = 4;

    /** 将比率转换为百分比的乘数。 */
    private static final int PERCENTAGE_MULTIPLIER = 100;

    /**
     * 计算绝对价格变动。
     *
     * @param price     当前价格
     * @param prevClose 前收盘价
     * @return 变动金额，如果任一输入为null则返回{@code null}
     */
    public BigDecimal calculateChange(BigDecimal price, BigDecimal prevClose) {
        if (price == null || prevClose == null) {
            return null;
        }
        return price.subtract(prevClose);
    }

    /**
     * 给定绝对变动和前收盘价，计算百分比变动。
     *
     * @param change    绝对变动
     * @param prevClose 前收盘价
     * @return 百分比变动，如果输入无效或{@code prevClose}为零则返回{@code null}
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
