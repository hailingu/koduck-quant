package com.koduck.market.application;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.ta4j.core.Bar;
import org.ta4j.core.BarSeries;
import org.ta4j.core.BaseBar;
import org.ta4j.core.BaseBarSeriesBuilder;
import org.ta4j.core.indicators.EMAIndicator;
import org.ta4j.core.indicators.MACDIndicator;
import org.ta4j.core.indicators.RSIIndicator;
import org.ta4j.core.indicators.SMAIndicator;
import org.ta4j.core.indicators.bollinger.BollingerBandsLowerIndicator;
import org.ta4j.core.indicators.bollinger.BollingerBandsMiddleIndicator;
import org.ta4j.core.indicators.bollinger.BollingerBandsUpperIndicator;
import org.ta4j.core.indicators.helpers.ClosePriceIndicator;
import org.ta4j.core.indicators.helpers.VolumeIndicator;
import org.ta4j.core.indicators.statistics.StandardDeviationIndicator;
import org.ta4j.core.num.DecimalNum;
import org.ta4j.core.num.Num;

import com.koduck.common.constants.MarketConstants;
import com.koduck.dto.indicator.IndicatorListResponse;
import com.koduck.dto.indicator.IndicatorResponse;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.exception.BusinessException;
import com.koduck.exception.ErrorCode;
import com.koduck.exception.ValidationException;
import com.koduck.service.KlineService;
import com.koduck.service.TechnicalIndicatorService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Implementation of TechnicalIndicatorService.
 *
 * @author Koduck Team
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TechnicalIndicatorServiceImpl implements TechnicalIndicatorService {

    /**
     * The kline service for fetching market data.
     */
    private final KlineService klineService;

    /**
     * Default limit for kline data.
     */
    private static final int DEFAULT_LIMIT = 100;

    /**
     * Scale for BigDecimal calculations.
     */
    private static final int SCALE = 4;

    @Override
    public IndicatorListResponse getAvailableIndicators() {
        List<IndicatorListResponse.IndicatorInfo> indicators = Arrays.asList(
            new IndicatorListResponse.IndicatorInfo(
                "MA", "Moving Average", "Simple Moving Average",
                Arrays.asList(5, 10, 20, 60), "TREND"),
            new IndicatorListResponse.IndicatorInfo(
                "EMA", "Exponential Moving Average", "Exponential Moving Average",
                Arrays.asList(5, 10, 20, 60), "TREND"),
            new IndicatorListResponse.IndicatorInfo(
                "MACD", "MACD", "Moving Average Convergence Divergence",
                Arrays.asList(12, 26, 9), "MOMENTUM"),
            new IndicatorListResponse.IndicatorInfo(
                "RSI", "RSI", "Relative Strength Index",
                Arrays.asList(6, 12, 24), "MOMENTUM"),
            new IndicatorListResponse.IndicatorInfo(
                "BOLL", "Bollinger Bands", "Bollinger Bands",
                Arrays.asList(20), "VOLATILITY"),
            new IndicatorListResponse.IndicatorInfo(
                "VOL", "Volume", "Trading Volume",
                Arrays.asList(5, 10), "VOLUME")
        );
        return IndicatorListResponse.builder()
            .indicators(indicators)
            .build();
    }

    @Override
    public IndicatorResponse calculateIndicator(String market, String symbol, String indicator,
                                                Integer period) {
        log.debug("Calculating indicator: market={}, symbol={}, indicator={}, period={}",
                 market, symbol, indicator, period);
        // Get kline data
        List<KlineDataDto> klineData = klineService.getKlineData(
            market, symbol, MarketConstants.DEFAULT_TIMEFRAME, DEFAULT_LIMIT, null);
        if (klineData.isEmpty()) {
            throw new BusinessException(
                    ErrorCode.MARKET_DATA_NOT_FOUND,
                    "No kline data found for " + market + "/" + symbol);
        }
        // Convert to BarSeries
        BarSeries series = convertToBarSeries(klineData);
        // Calculate indicator
        return switch (indicator.toUpperCase(Locale.ROOT)) {
            case "MA", "SMA" -> calculateMA(series, market, symbol, period != null ? period : 20);
            case "EMA" -> calculateEMA(series, market, symbol, period != null ? period : 20);
            case "MACD" -> calculateMACD(series, market, symbol);
            case "RSI" -> calculateRSI(series, market, symbol, period != null ? period : 14);
            case "BOLL" -> calculateBOLL(series, market, symbol, period != null ? period : 20);
            case "VOL" -> calculateVOL(series, market, symbol, period != null ? period : 5);
            default -> throw new ValidationException("Unsupported indicator: " + indicator);
        };
    }

    /**
     * Calculate Simple Moving Average (MA/SMA).
     *
     * @param series the bar series
     * @param market the market
     * @param symbol the symbol
     * @param period the period
     * @return the indicator response
     */
    private IndicatorResponse calculateMA(BarSeries series, String market, String symbol,
                                          int period) {
        ClosePriceIndicator closePrice = new ClosePriceIndicator(series);
        SMAIndicator sma = new SMAIndicator(closePrice, period);
        int lastIndex = series.getEndIndex();
        BigDecimal value = toBigDecimal(sma.getValue(lastIndex));
        BigDecimal prevValue = lastIndex > 0 ? toBigDecimal(sma.getValue(lastIndex - 1)) : value;
        String trend = determineTrend(value, prevValue);
        Map<String, BigDecimal> values = new HashMap<>();
        values.put("ma", value);
        return IndicatorResponse.builder()
            .symbol(symbol)
            .market(market)
            .indicator("MA" + period)
            .period(period)
            .values(values)
            .trend(trend)
            .timestamp(LocalDateTime.now())
            .build();
    }

    /**
     * Calculate Exponential Moving Average (EMA).
     *
     * @param series the bar series
     * @param market the market
     * @param symbol the symbol
     * @param period the period
     * @return the indicator response
     */
    private IndicatorResponse calculateEMA(BarSeries series, String market, String symbol,
                                           int period) {
        ClosePriceIndicator closePrice = new ClosePriceIndicator(series);
        EMAIndicator ema = new EMAIndicator(closePrice, period);
        int lastIndex = series.getEndIndex();
        BigDecimal value = toBigDecimal(ema.getValue(lastIndex));
        BigDecimal prevValue = lastIndex > 0 ? toBigDecimal(ema.getValue(lastIndex - 1)) : value;
        String trend = determineTrend(value, prevValue);
        Map<String, BigDecimal> values = new HashMap<>();
        values.put("ema", value);
        return IndicatorResponse.builder()
            .symbol(symbol)
            .market(market)
            .indicator("EMA" + period)
            .period(period)
            .values(values)
            .trend(trend)
            .timestamp(LocalDateTime.now())
            .build();
    }

    /**
     * Calculate MACD (Moving Average Convergence Divergence).
     *
     * @param series the bar series
     * @param market the market
     * @param symbol the symbol
     * @return the indicator response
     */
    private IndicatorResponse calculateMACD(BarSeries series, String market, String symbol) {
        ClosePriceIndicator closePrice = new ClosePriceIndicator(series);
        MACDIndicator macd = new MACDIndicator(closePrice, 12, 26);
        int lastIndex = series.getEndIndex();
        BigDecimal macdValue = toBigDecimal(macd.getValue(lastIndex));
        // Calculate signal line (9-day EMA of MACD)
        EMAIndicator signalLine = new EMAIndicator(macd, 9);
        BigDecimal signalValue = toBigDecimal(signalLine.getValue(lastIndex));
        // Calculate histogram
        BigDecimal histogram = macdValue.subtract(signalValue);
        String trend = histogram.compareTo(BigDecimal.ZERO) > 0 ? "UP" : "DOWN";
        Map<String, BigDecimal> values = new HashMap<>();
        values.put("macd", macdValue);
        values.put("signal", signalValue);
        values.put("histogram", histogram);
        return IndicatorResponse.builder()
            .symbol(symbol)
            .market(market)
            .indicator("MACD")
            .period(12)
            .values(values)
            .trend(trend)
            .timestamp(LocalDateTime.now())
            .build();
    }

    /**
     * Calculate RSI (Relative Strength Index).
     *
     * @param series the bar series
     * @param market the market
     * @param symbol the symbol
     * @param period the period
     * @return the indicator response
     */
    private IndicatorResponse calculateRSI(BarSeries series, String market, String symbol,
                                           int period) {
        ClosePriceIndicator closePrice = new ClosePriceIndicator(series);
        RSIIndicator rsi = new RSIIndicator(closePrice, period);
        int lastIndex = series.getEndIndex();
        BigDecimal value = toBigDecimal(rsi.getValue(lastIndex));
        // Determine trend based on RSI levels
        String trend;
        if (value.compareTo(new BigDecimal("70")) > 0) {
            trend = "OVERBOUGHT";
        } else if (value.compareTo(new BigDecimal("30")) < 0) {
            trend = "OVERSOLD";
        } else {
            trend = "NEUTRAL";
        }
        Map<String, BigDecimal> values = new HashMap<>();
        values.put("rsi", value);
        return IndicatorResponse.builder()
            .symbol(symbol)
            .market(market)
            .indicator("RSI" + period)
            .period(period)
            .values(values)
            .trend(trend)
            .timestamp(LocalDateTime.now())
            .build();
    }

    /**
     * Calculate Bollinger Bands (BOLL).
     *
     * @param series the bar series
     * @param market the market
     * @param symbol the symbol
     * @param period the period
     * @return the indicator response
     */
    private IndicatorResponse calculateBOLL(BarSeries series, String market, String symbol,
                                            int period) {
        ClosePriceIndicator closePrice = new ClosePriceIndicator(series);
        SMAIndicator sma = new SMAIndicator(closePrice, period);
        StandardDeviationIndicator stdDev = new StandardDeviationIndicator(sma, period);
        BollingerBandsMiddleIndicator middle = new BollingerBandsMiddleIndicator(sma);
        BollingerBandsUpperIndicator upper = new BollingerBandsUpperIndicator(
            middle, stdDev, DecimalNum.valueOf(2));
        BollingerBandsLowerIndicator lower = new BollingerBandsLowerIndicator(
            middle, stdDev, DecimalNum.valueOf(2));
        int lastIndex = series.getEndIndex();
        BigDecimal middleValue = toBigDecimal(middle.getValue(lastIndex));
        BigDecimal upperValue = toBigDecimal(upper.getValue(lastIndex));
        BigDecimal lowerValue = toBigDecimal(lower.getValue(lastIndex));
        BigDecimal currentPrice = toBigDecimal(closePrice.getValue(lastIndex));
        // Determine position within bands
        String trend;
        if (currentPrice.compareTo(upperValue) > 0) {
            trend = "ABOVE_UPPER";
        } else if (currentPrice.compareTo(lowerValue) < 0) {
            trend = "BELOW_LOWER";
        } else {
            trend = "WITHIN_BANDS";
        }
        Map<String, BigDecimal> values = new HashMap<>();
        values.put("middle", middleValue);
        values.put("upper", upperValue);
        values.put("lower", lowerValue);
        return IndicatorResponse.builder()
            .symbol(symbol)
            .market(market)
            .indicator("BOLL" + period)
            .period(period)
            .values(values)
            .trend(trend)
            .timestamp(LocalDateTime.now())
            .build();
    }

    /**
     * Calculate Volume (VOL).
     *
     * @param series the bar series
     * @param market the market
     * @param symbol the symbol
     * @param period the period
     * @return the indicator response
     */
    private IndicatorResponse calculateVOL(BarSeries series, String market, String symbol,
                                           int period) {
        VolumeIndicator volume = new VolumeIndicator(series, period);
        int lastIndex = series.getEndIndex();
        BigDecimal value = toBigDecimal(volume.getValue(lastIndex));
        // Get current volume
        BigDecimal currentVolume = toBigDecimal(series.getBar(lastIndex).getVolume());
        String trend = currentVolume.compareTo(value) > 0 ? "ABOVE_AVERAGE" : "BELOW_AVERAGE";
        Map<String, BigDecimal> values = new HashMap<>();
        values.put("volume", currentVolume);
        values.put("avgVolume", value);
        return IndicatorResponse.builder()
            .symbol(symbol)
            .market(market)
            .indicator("VOL" + period)
            .period(period)
            .values(values)
            .trend(trend)
            .timestamp(LocalDateTime.now())
            .build();
    }

    /**
     * Convert KlineDataDto list to BarSeries.
     *
     * @param klineData the list of kline data
     * @return the bar series
     */
    private BarSeries convertToBarSeries(List<KlineDataDto> klineData) {
        BarSeries series = new BaseBarSeriesBuilder().withNumTypeOf(DecimalNum.class).build();
        // Reverse to chronological order (oldest first)
        List<KlineDataDto> sortedData = new ArrayList<>(klineData);
        Collections.reverse(sortedData);
        for (KlineDataDto dto : sortedData) {
            ZonedDateTime dateTime = ZonedDateTime.ofInstant(
                java.time.Instant.ofEpochSecond(dto.timestamp()), ZoneId.systemDefault());
            Bar bar = new BaseBar(
                java.time.Duration.ofDays(1),
                dateTime,
                DecimalNum.valueOf(dto.open().toString()),
                DecimalNum.valueOf(dto.high().toString()),
                DecimalNum.valueOf(dto.low().toString()),
                DecimalNum.valueOf(dto.close().toString()),
                DecimalNum.valueOf(dto.volume().toString()),
                DecimalNum.ZERO);
            series.addBar(bar);
        }
        return series;
    }

    /**
     * Convert DecimalNum to BigDecimal.
     *
     * @param num the number
     * @return the BigDecimal value
     */
    private BigDecimal toBigDecimal(Num num) {
        return new BigDecimal(num.toString()).setScale(SCALE, RoundingMode.HALF_UP);
    }

    /**
     * Determine trend based on current and previous values.
     *
     * @param current the current value
     * @param previous the previous value
     * @return the trend string
     */
    private String determineTrend(BigDecimal current, BigDecimal previous) {
        if (current.compareTo(previous) > 0) {
            return "UP";
        } else if (current.compareTo(previous) < 0) {
            return "DOWN";
        } else {
            return "FLAT";
        }
    }
}
