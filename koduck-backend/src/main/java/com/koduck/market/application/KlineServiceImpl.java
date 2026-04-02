package com.koduck.market.application;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import com.koduck.common.constants.MarketConstants;
import com.koduck.config.CacheConfig;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.entity.KlineData;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.KlineDataRepository;
import com.koduck.repository.StockRealtimeRepository;
import com.koduck.service.KlineService;

import lombok.extern.slf4j.Slf4j;

/**
 * Implementation of K-line data service.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Service
@Slf4j
public class KlineServiceImpl implements KlineService {

    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Shanghai");
    private static final String DEFAULT_MARKET = MarketConstants.DEFAULT_MARKET;
    private static final String DEFAULT_TIMEFRAME = MarketConstants.DEFAULT_TIMEFRAME;
    private static final String WEEKLY_TIMEFRAME = MarketConstants.WEEKLY_TIMEFRAME;
    private static final String MONTHLY_TIMEFRAME = MarketConstants.MONTHLY_TIMEFRAME;

    private final KlineDataRepository klineDataRepository;
    private final StockRealtimeRepository stockRealtimeRepository;

    public KlineServiceImpl(KlineDataRepository klineDataRepository,
                            StockRealtimeRepository stockRealtimeRepository) {
        this.klineDataRepository = klineDataRepository;
        this.stockRealtimeRepository = stockRealtimeRepository;
    }

    @Override
    @Cacheable(
            value = CacheConfig.CACHE_KLINE,
            key = "#market + ':' + #symbol + ':' + #timeframe + ':' + #limit + ':' + #beforeTime",
            unless = "#result == null || #result.isEmpty()")
    public List<KlineDataDto> getKlineData(String market, String symbol, String timeframe,
                                           Integer limit, Long beforeTime) {
        log.debug("Getting kline data: market={}, symbol={}, timeframe={}, limit={}, beforeTime={}",
                market, symbol, timeframe, limit, beforeTime);
        Pageable pageable = PageRequest.of(0, limit);
        List<KlineData> data;
        if (beforeTime != null) {
            LocalDateTime beforeDateTime = LocalDateTime.ofInstant(
                    Instant.ofEpochSecond(beforeTime), ZoneId.systemDefault());
            data = queryBeforeTimeWithFallback(market, symbol, timeframe, beforeDateTime, pageable);
        } else {
            data = queryKlineWithFallback(market, symbol, timeframe, pageable);
        }
        // Reverse to ascending order (oldest to newest) for frontend charting
        List<KlineDataDto> result = new ArrayList<>(data.stream()
            .map(this::convertToDto)
            .toList());
        java.util.Collections.reverse(result);
        // Remove duplicate timestamps (keep latest)
        return deduplicateByTimestamp(result, timeframe);
    }
    @Override
    @Cacheable(value = CacheConfig.CACHE_PRICE, key = "#market + ':' + #symbol + ':' + #timeframe", unless = "#result == null or #result.isEmpty()")
    public Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe) {
        Optional<BigDecimal> realtimePrice = getLatestRealtimePrice(symbol);
        if (realtimePrice.isPresent()) {
            return realtimePrice;
        }
        for (String marketCandidate : buildMarketCandidates(market)) {
            for (String symbolCandidate : buildSymbolCandidates(symbol)) {
                for (String timeframeCandidate : buildTimeframeCandidates(timeframe)) {
                    Optional<KlineData> latest = klineDataRepository
                            .findFirstByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
                                    marketCandidate, symbolCandidate, timeframeCandidate);
                    if (latest.isPresent()) {
                        return latest.map(KlineData::getClosePrice);
                    }
                }
            }
        }
        return Optional.empty();
    }
    private Optional<BigDecimal> getLatestRealtimePrice(String symbol) {
        for (String symbolCandidate : buildSymbolCandidates(symbol)) {
            Optional<BigDecimal> price = stockRealtimeRepository
                    .findFirstBySymbolOrderByUpdatedAtDesc(symbolCandidate)
                    .map(StockRealtime::getPrice)
                    .filter(value -> value != null && value.compareTo(BigDecimal.ZERO) > 0);
            if (price.isPresent()) {
                return price;
            }
        }
        return Optional.empty();
    }
    @Override
    @Cacheable(value = CacheConfig.CACHE_KLINE, key = "#market + ':' + #symbol + ':' + #timeframe + ':prevClose'")
    public Optional<BigDecimal> getPreviousClosePrice(String market, String symbol, String timeframe) {
        Pageable pageable = PageRequest.of(0, 2);
        List<KlineData> data = queryKlineWithFallback(market, symbol, timeframe, pageable);
        // Return the second record (yesterday's close), skipping the most recent one
        if (data.size() >= 2) {
            return Optional.of(data.get(1).getClosePrice());
        }
        return Optional.empty();
    }
    @Override
    public Optional<KlineData> getLatestKline(String market, String symbol, String timeframe) {
        for (String marketCandidate : buildMarketCandidates(market)) {
            for (String symbolCandidate : buildSymbolCandidates(symbol)) {
                for (String timeframeCandidate : buildTimeframeCandidates(timeframe)) {
                    Optional<KlineData> latest = klineDataRepository
                            .findFirstByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
                                    marketCandidate, symbolCandidate, timeframeCandidate);
                    if (latest.isPresent()) {
                        return latest;
                    }
                }
            }
        }
        return Optional.empty();
    }
    private List<KlineData> queryKlineWithFallback(String market, String symbol, String timeframe, Pageable pageable) {
        for (String marketCandidate : buildMarketCandidates(market)) {
            for (String symbolCandidate : buildSymbolCandidates(symbol)) {
                for (String timeframeCandidate : buildTimeframeCandidates(timeframe)) {
                    List<KlineData> data = klineDataRepository
                            .findByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
                                    marketCandidate, symbolCandidate, timeframeCandidate, pageable);
                    if (!data.isEmpty()) {
                        return data;
                    }
                }
            }
        }
        return List.of();
    }
    private List<KlineData> queryBeforeTimeWithFallback(
            String market,
            String symbol,
            String timeframe,
            LocalDateTime beforeDateTime,
            Pageable pageable) {
        for (String marketCandidate : buildMarketCandidates(market)) {
            for (String symbolCandidate : buildSymbolCandidates(symbol)) {
                for (String timeframeCandidate : buildTimeframeCandidates(timeframe)) {
                    List<KlineData> data = klineDataRepository.findBeforeTime(
                            marketCandidate, symbolCandidate, timeframeCandidate, beforeDateTime, pageable);
                    if (!data.isEmpty()) {
                        return data;
                    }
                }
            }
        }
        return List.of();
    }
    private List<String> buildMarketCandidates(String market) {
        // Strict match only - avoid cross-market data mixing
        if (market == null || market.isBlank()) {
            return List.of(DEFAULT_MARKET);
        }
        return List.of(market.trim());
    }
    private List<String> buildTimeframeCandidates(String timeframe) {
        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        if (timeframe == null || timeframe.isBlank()) {
            candidates.add(DEFAULT_TIMEFRAME);
            return new ArrayList<>(candidates);
        }
        String normalized = timeframe.trim();
        String lowerNormalized = normalized.toLowerCase(Locale.ROOT);
        boolean minuteTimeframe = lowerNormalized.matches("^\\d+m$");
        candidates.add(normalized);
        candidates.add(lowerNormalized);
        if (!minuteTimeframe) {
            candidates.add(normalized.toUpperCase(Locale.ROOT));
        }
        String alias = normalizeTimeframeAlias(normalized);
        if (!alias.isBlank()) {
            candidates.add(alias);
            candidates.add(alias.toLowerCase(Locale.ROOT));
            if (!minuteTimeframe) {
                candidates.add(alias.toUpperCase(Locale.ROOT));
            }
        }
        return new ArrayList<>(candidates);
    }
    private List<String> buildSymbolCandidates(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return List.of();
        }
        // Strict match only - return exact symbol to avoid cross-stock data mixing
        return List.of(symbol.trim());
    }
    private String normalizeTimeframeAlias(String timeframe) {
        String lower = timeframe.toLowerCase(Locale.ROOT);
        return switch (lower) {
            case "1d", "day", "daily" -> DEFAULT_TIMEFRAME;
            case "1w", "week", "weekly" -> WEEKLY_TIMEFRAME;
            case "month", "monthly", "1mo", "1mth" -> MONTHLY_TIMEFRAME;
            default -> timeframe;
        };
    }
    @Override
    @Caching(evict = {
            @CacheEvict(value = CacheConfig.CACHE_KLINE, allEntries = true),
            @CacheEvict(value = CacheConfig.CACHE_PRICE, key = "#market + ':' + #symbol + ':' + #timeframe")
    })
    public void saveKlineData(List<KlineDataDto> dtos, String market, String symbol, String timeframe) {
        List<KlineData> entities = dtos.stream()
                .map(dto -> convertToEntity(dto, market, symbol, timeframe))
                .filter(Objects::nonNull)
                .filter(entity -> !klineDataRepository.existsByMarketAndSymbolAndTimeframeAndKlineTime(
                        market, symbol, timeframe, entity.getKlineTime()))
                .toList();
        if (!entities.isEmpty()) {
            klineDataRepository.saveAll(entities);
            log.info("Saved {} kline records for {}/{}/{}", entities.size(), market, symbol, timeframe);
        }
    }
    private KlineDataDto convertToDto(KlineData entity) {
        return KlineDataDto.builder()
                .timestamp(entity.getKlineTime().atZone(MARKET_ZONE).toEpochSecond())
                .open(entity.getOpenPrice())
                .high(entity.getHighPrice())
                .low(entity.getLowPrice())
                .close(entity.getClosePrice())
                .volume(entity.getVolume())
                .amount(entity.getAmount())
                .build();
    }
    private KlineData convertToEntity(KlineDataDto dto, String market, String symbol, String timeframe) {
        if (dto == null || dto.timestamp() == null) {
            log.warn("Skipping invalid KlineDataDto: timestamp is null");
            return null;
        }
        LocalDateTime klineTime = LocalDateTime.ofInstant(
                Instant.ofEpochSecond(dto.timestamp()), MARKET_ZONE);
        return KlineData.builder()
                .market(market)
                .symbol(symbol)
                .timeframe(timeframe)
                .klineTime(klineTime)
                .openPrice(dto.open())
                .highPrice(dto.high())
                .lowPrice(dto.low())
                .closePrice(dto.close())
                .volume(dto.volume())
                .amount(dto.amount())
                .build();
    }
    /**
     * Remove duplicate timestamps from K-line data.
     * For minute-level timeframes: exact timestamp deduplication.
     * For daily/weekly/monthly: date-based deduplication (86400s boundary).
     */
    private List<KlineDataDto> deduplicateByTimestamp(List<KlineDataDto> data, String timeframe) {
        if (data == null || data.size() <= 1) {
            return data;
        }
        boolean isDailyOrHigher = timeframe != null && 
            (timeframe.equalsIgnoreCase(DEFAULT_TIMEFRAME) || 
             timeframe.equalsIgnoreCase(WEEKLY_TIMEFRAME) || 
             timeframe.equalsIgnoreCase(MONTHLY_TIMEFRAME) ||
             timeframe.toLowerCase(Locale.ROOT).matches("^(day|daily|week|weekly|month|monthly|1mth|1mo)$"));
        java.util.LinkedHashMap<Long, KlineDataDto> uniqueMap = new java.util.LinkedHashMap<>();
        for (KlineDataDto item : data) {
            Long key;
            if (isDailyOrHigher) {
                // Normalize to date boundary (00:00:00) for daily/weekly/monthly
                key = (item.timestamp() / 86400L) * 86400L;
            } else {
                // Use exact timestamp for minute-level data
                key = item.timestamp();
            }
            uniqueMap.put(key, item); // Keep latest for duplicates
        }
        List<KlineDataDto> result = new ArrayList<>(uniqueMap.values());
        int removed = data.size() - result.size();
        if (removed > 0) {
            log.debug("Removed {} duplicate timestamp records from K-line data (timeframe={})", removed, timeframe);
        }
        return result;
    }
}
