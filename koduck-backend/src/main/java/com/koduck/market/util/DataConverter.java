package com.koduck.market.util;

import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Utility class for converting data between different formats.
 * Provides standardized conversion methods for market data.
 */
public final class DataConverter {
    
    private static final DateTimeFormatter DATE_FORMATTER = 
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    
    private DataConverter() {
        // Utility class, prevent instantiation
    }
    
    /**
     * Convert string price to BigDecimal
     * 
     * @param priceStr price string
     * @return BigDecimal or ZERO if invalid
     */
    public static BigDecimal toBigDecimal(String priceStr) {
        if (priceStr == null || priceStr.trim().isEmpty()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(priceStr.trim());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }
    
    /**
     * Convert string volume to Long
     * 
     * @param volumeStr volume string
     * @return Long or 0 if invalid
     */
    public static Long toLong(String volumeStr) {
        if (volumeStr == null || volumeStr.trim().isEmpty()) {
            return 0L;
        }
        try {
            return Long.parseLong(volumeStr.trim());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
    
    /**
     * Convert timestamp string to Instant
     * 
     * @param timestamp timestamp string (supports various formats)
     * @return Instant or null if invalid
     */
    public static Instant toInstant(String timestamp) {
        if (timestamp == null || timestamp.trim().isEmpty()) {
            return null;
        }
        
        // Try epoch milliseconds
        try {
            long epochMillis = Long.parseLong(timestamp.trim());
            return Instant.ofEpochMilli(epochMillis);
        } catch (NumberFormatException ignored) {
        }
        
        // Try ISO format
        try {
            return Instant.parse(timestamp.trim());
        } catch (Exception ignored) {
        }
        
        // Try custom format
        try {
            LocalDateTime dateTime = LocalDateTime.parse(timestamp.trim(), DATE_FORMATTER);
            return dateTime.atZone(ZoneId.systemDefault()).toInstant();
        } catch (Exception ignored) {
        }
        
        return null;
    }
    
    /**
     * Convert seconds timestamp to Instant
     * 
     * @param seconds seconds since epoch
     * @return Instant
     */
    public static Instant toInstant(long seconds) {
        return Instant.ofEpochSecond(seconds);
    }
    
    /**
     * Convert milliseconds timestamp to Instant
     * 
     * @param millis milliseconds since epoch
     * @return Instant
     */
    public static Instant toInstantFromMillis(long millis) {
        return Instant.ofEpochMilli(millis);
    }
    
    /**
     * Format Instant to string
     * 
     * @param instant the instant
     * @return formatted string
     */
    public static String formatInstant(Instant instant) {
        if (instant == null) {
            return "";
        }
        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault())
                           .format(DATE_FORMATTER);
    }
    
    /**
     * Normalize symbol code
     * 
     * @param symbol raw symbol
     * @param market market type
     * @return normalized symbol
     */
    public static String normalizeSymbol(String symbol, String market) {
        if (symbol == null || symbol.trim().isEmpty()) {
            return "";
        }
        
        String normalized = symbol.trim().toUpperCase(Locale.ROOT);
        
        // Add market suffix if not present
        if ("a_share".equals(market) && !normalized.contains(".")) {
            // A-Share: add exchange suffix based on first digit
            if (normalized.length() == 6) {
                char firstDigit = normalized.charAt(0);
                if (firstDigit == '6') {
                    normalized += ".SH";
                } else {
                    normalized += ".SZ";
                }
            }
        }
        
        return normalized;
    }
    
    /**
     * Convert k-line data to tick data (using close price)
     * 
     * @param kline the k-line data
     * @return tick data
     */
    public static TickData klineToTick(KlineData kline) {
        if (kline == null) {
            return null;
        }
        
        return TickData.builder()
            .symbol(kline.symbol())
            .market(kline.market())
            .timestamp(kline.timestamp())
            .price(kline.close())
            .open(kline.open())
            .dayHigh(kline.high())
            .dayLow(kline.low())
            .volume(kline.volume())
            .amount(kline.amount())
            .change(kline.getPriceChange())
            .changePercent(kline.getPriceChangePercent())
            .build();
    }
    
    /**
     * Calculate VWAP (Volume Weighted Average Price)
     * 
     * @param klines list of k-line data
     * @return VWAP or ZERO if no data
     */
    public static BigDecimal calculateVWAP(List<KlineData> klines) {
        if (klines == null || klines.isEmpty()) {
            return BigDecimal.ZERO;
        }
        
        BigDecimal totalTPV = BigDecimal.ZERO; // Typical Price * Volume
        long totalVolume = 0;
        
        for (KlineData kline : klines) {
            // Typical Price = (High + Low + Close) / 3
            BigDecimal typicalPrice = kline.high()
                .add(kline.low())
                .add(kline.close())
                .divide(BigDecimal.valueOf(3), 8, RoundingMode.HALF_UP);
            
            totalTPV = totalTPV.add(typicalPrice.multiply(BigDecimal.valueOf(kline.volume())));
            totalVolume += kline.volume();
        }
        
        if (totalVolume == 0) {
            return BigDecimal.ZERO;
        }
        
        return totalTPV.divide(BigDecimal.valueOf(totalVolume), 4, RoundingMode.HALF_UP);
    }
}
