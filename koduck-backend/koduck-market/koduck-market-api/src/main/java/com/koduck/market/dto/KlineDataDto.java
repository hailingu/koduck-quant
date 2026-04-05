package com.koduck.market.dto;

import java.math.BigDecimal;

/**
 * K-line (candlestick) data DTO.
 *
 * @param timestamp 时间戳
 * @param open 开盘价
 * @param high 最高价
 * @param low 最低价
 * @param close the close price
 * @param volume 成交量
 * @param amount 成交额
 * @author Koduck Team
 */
public record KlineDataDto(
    Long timestamp,
    BigDecimal open,
    BigDecimal high,
    BigDecimal low,
    BigDecimal close,
    Long volume,
    BigDecimal amount
) {
    
    public static Builder builder() {
        return new Builder();
    }
    
    public static class Builder {
        /** Timestamp. */
        private Long timestamp;
        /** Open price. */
        private BigDecimal open;
        /** High price. */
        private BigDecimal high;
        /** Low price. */
        private BigDecimal low;
        /** Close price. */
        private BigDecimal close;
        /** Volume. */
        private Long volume;
        /** Amount. */
        private BigDecimal amount;
        
        public Builder timestamp(Long timestamp) {
            this.timestamp = timestamp;
            return this;
        }
        
        public Builder open(BigDecimal open) {
            this.open = open;
            return this;
        }
        
        public Builder high(BigDecimal high) {
            this.high = high;
            return this;
        }
        
        public Builder low(BigDecimal low) {
            this.low = low;
            return this;
        }
        
        public Builder close(BigDecimal close) {
            this.close = close;
            return this;
        }
        
        public Builder volume(Long volume) {
            this.volume = volume;
            return this;
        }
        
        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }
        
        public KlineDataDto build() {
            return new KlineDataDto(timestamp, open, high, low, close, volume, amount);
        }
    }
}
