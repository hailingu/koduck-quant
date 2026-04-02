package com.koduck.market.util;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.koduck.market.model.KlineData;
import com.koduck.market.model.TickData;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for DataConverter
 */
class DataConverterTest {
    
    @Test
    void testToBigDecimal() {
        assertEquals(new BigDecimal("123.45"), DataConverter.toBigDecimal("123.45"));
        assertEquals(BigDecimal.ZERO, DataConverter.toBigDecimal(null));
        assertEquals(BigDecimal.ZERO, DataConverter.toBigDecimal(""));
        assertEquals(BigDecimal.ZERO, DataConverter.toBigDecimal("invalid"));
    }
    
    @Test
    void testToLong() {
        assertEquals(12345L, DataConverter.toLong("12345"));
        assertEquals(0L, DataConverter.toLong(null));
        assertEquals(0L, DataConverter.toLong(""));
        assertEquals(0L, DataConverter.toLong("invalid"));
    }
    
    @Test
    void testToInstantFromEpochMillis() {
        long millis = 1609459200000L; // 2021-01-01 00:00:00 UTC
        Instant instant = DataConverter.toInstant(String.valueOf(millis));
        assertNotNull(instant);
        assertEquals(millis, instant.toEpochMilli());
    }
    
    @Test
    void testToInstantFromISO() {
        String iso = "2021-01-01T00:00:00Z";
        Instant instant = DataConverter.toInstant(iso);
        assertNotNull(instant);
        assertEquals(iso, instant.toString());
    }
    
    @Test
    void testToInstantInvalid() {
        assertNull(DataConverter.toInstant(null));
        assertNull(DataConverter.toInstant(""));
        assertNull(DataConverter.toInstant("invalid"));
    }
    
    @Test
    void testToInstantFromSeconds() {
        long seconds = 1609459200L;
        Instant instant = DataConverter.toInstant(seconds);
        assertEquals(seconds, instant.getEpochSecond());
    }
    
    @Test
    void testToInstantFromMillis() {
        long millis = 1609459200000L;
        Instant instant = DataConverter.toInstantFromMillis(millis);
        assertEquals(millis, instant.toEpochMilli());
    }
    
    @Test
    void testNormalizeSymbol() {
        // A-Share without suffix
        assertEquals("600519.SH", DataConverter.normalizeSymbol("600519", "a_share"));
        assertEquals("000001.SZ", DataConverter.normalizeSymbol("000001", "a_share"));
        
        // A-Share with suffix (should not change)
        assertEquals("600519.SH", DataConverter.normalizeSymbol("600519.SH", "a_share"));
        
        // Other markets
        assertEquals("AAPL", DataConverter.normalizeSymbol("AAPL", "us_stock"));
        assertEquals("0700.HK", DataConverter.normalizeSymbol("0700.HK", "hk_stock"));
        
        // Null or empty
        assertEquals("", DataConverter.normalizeSymbol(null, "a_share"));
        assertEquals("", DataConverter.normalizeSymbol("", "a_share"));
    }
    
    @Test
    void testKlineToTick() {
        Instant now = Instant.now();
        KlineData kline = KlineData.builder()
            .symbol("600519")
            .market("a_share")
            .timestamp(now)
            .open(new BigDecimal("100"))
            .high(new BigDecimal("110"))
            .low(new BigDecimal("95"))
            .close(new BigDecimal("105"))
            .volume(10000L)
            .amount(new BigDecimal("1000000"))
            .timeframe("1d")
            .build();
        
        TickData tick = DataConverter.klineToTick(kline);
        
        assertNotNull(tick);
        assertEquals("600519", tick.symbol());
        assertEquals("a_share", tick.market());
        assertEquals(now, tick.timestamp());
        assertEquals(new BigDecimal("105"), tick.price());
        assertEquals(new BigDecimal("110"), tick.dayHigh());
        assertEquals(new BigDecimal("95"), tick.dayLow());
        assertEquals(Long.valueOf(10000L), tick.volume());
    }
    
    @Test
    void testKlineToTickNull() {
        assertNull(DataConverter.klineToTick(null));
    }
    
    @Test
    void testCalculateVWAP() {
        List<KlineData> klines = Arrays.asList(
            KlineData.builder()
                .symbol("TEST")
                .high(new BigDecimal("110"))
                .low(new BigDecimal("90"))
                .close(new BigDecimal("100"))
                .volume(1000L)
                .build(),
            KlineData.builder()
                .symbol("TEST")
                .high(new BigDecimal("120"))
                .low(new BigDecimal("100"))
                .close(new BigDecimal("110"))
                .volume(2000L)
                .build()
        );
        
        BigDecimal vwap = DataConverter.calculateVWAP(klines);
        
        assertNotNull(vwap);
        assertTrue(vwap.compareTo(BigDecimal.ZERO) > 0);
    }
    
    @Test
    void testCalculateVWAPEmpty() {
        assertEquals(BigDecimal.ZERO, DataConverter.calculateVWAP(null));
        assertEquals(BigDecimal.ZERO, DataConverter.calculateVWAP(Arrays.asList()));
    }
    
    @Test
    void testCalculateVWAPZeroVolume() {
        List<KlineData> klines = Arrays.asList(
            KlineData.builder()
                .symbol("TEST")
                .high(new BigDecimal("100"))
                .low(new BigDecimal("100"))
                .close(new BigDecimal("100"))
                .volume(0L)
                .build()
        );
        
        assertEquals(BigDecimal.ZERO, DataConverter.calculateVWAP(klines));
    }
}
