package com.koduck.service;

import com.koduck.config.CacheConfig;
import com.koduck.dto.market.KlineDataDto;
import com.koduck.entity.KlineData;
import com.koduck.repository.KlineDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for K-line data operations.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KlineService {

    private final KlineDataRepository klineDataRepository;

    /**
     * Get K-line data for a symbol.
     * Cached for 1 minute.
     */
    @Cacheable(value = CacheConfig.CACHE_KLINE, key = "#market + ':' + #symbol + ':' + #timeframe + ':' + #limit + ':' + #beforeTime")
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
        List<KlineDataDto> result = data.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
        java.util.Collections.reverse(result);
        return result;
    }

    /**
     * Get the latest price for a symbol.
     * Cached for 30 seconds.
     */
    @Cacheable(value = CacheConfig.CACHE_PRICE, key = "#market + ':' + #symbol + ':' + #timeframe")
    public Optional<BigDecimal> getLatestPrice(String market, String symbol, String timeframe) {
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

    /**
     * Get the previous close price (yesterday's close) for a symbol.
     * Used for calculating change and changePercent.
     * Cached for 1 minute.
     */
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

    /**
     * Get the latest K-line data record for a symbol.
     */
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
        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        if (market != null && !market.isBlank()) {
            String normalized = market.trim();
            candidates.add(normalized);
            candidates.add(normalized.toLowerCase(Locale.ROOT));
            candidates.add(normalized.toUpperCase(Locale.ROOT));
        }
        candidates.add("AShare");
        candidates.add("Ashare");
        candidates.add("ashare");
        return new ArrayList<>(candidates);
    }

    private List<String> buildTimeframeCandidates(String timeframe) {
        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        if (timeframe == null || timeframe.isBlank()) {
            candidates.add("1D");
            return new ArrayList<>(candidates);
        }

        String normalized = timeframe.trim();
        candidates.add(normalized);
        candidates.add(normalized.toLowerCase(Locale.ROOT));
        candidates.add(normalized.toUpperCase(Locale.ROOT));

        String alias = normalizeTimeframeAlias(normalized);
        if (alias != null && !alias.isBlank()) {
            candidates.add(alias);
            candidates.add(alias.toLowerCase(Locale.ROOT));
            candidates.add(alias.toUpperCase(Locale.ROOT));
        }
        return new ArrayList<>(candidates);
    }

    private List<String> buildSymbolCandidates(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return List.of();
        }

        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        String normalized = symbol.trim();
        candidates.add(normalized);

        String noPrefixZero = normalized.replaceFirst("^0+", "");
        if (!noPrefixZero.isEmpty()) {
            candidates.add(noPrefixZero);
        }

        if (normalized.matches("\\d{1,6}")) {
            try {
                candidates.add(String.format("%06d", Integer.parseInt(normalized)));
            } catch (NumberFormatException ignored) {
                // keep best-effort candidates only
            }
        }

        return new ArrayList<>(candidates);
    }

    private String normalizeTimeframeAlias(String timeframe) {
        String lower = timeframe.toLowerCase(Locale.ROOT);
        return switch (lower) {
            case "1d", "day", "daily" -> "1D";
            case "1w", "week", "weekly" -> "1W";
            case "month", "monthly", "1mo", "1mth" -> "1M";
            default -> timeframe;
        };
    }

    /**
     * Save K-line data.
     * Clears cache for the symbol after saving.
     */
    @CacheEvict(value = {CacheConfig.CACHE_KLINE, CacheConfig.CACHE_PRICE},
            key = "#market + ':' + #symbol + ':' + #timeframe")
    public void saveKlineData(List<KlineDataDto> dtos, String market, String symbol, String timeframe) {
        List<KlineData> entities = dtos.stream()
                .map(dto -> convertToEntity(dto, market, symbol, timeframe))
                .filter(entity -> !klineDataRepository.existsByMarketAndSymbolAndTimeframeAndKlineTime(
                        market, symbol, timeframe, entity.getKlineTime()))
                .collect(Collectors.toList());

        if (!entities.isEmpty()) {
            klineDataRepository.saveAll(entities);
            log.info("Saved {} kline records for {}/{}/{}", entities.size(), market, symbol, timeframe);
        }
    }

    private KlineDataDto convertToDto(KlineData entity) {
        return KlineDataDto.builder()
                .timestamp(entity.getKlineTime().atZone(ZoneId.systemDefault()).toEpochSecond())
                .open(entity.getOpenPrice())
                .high(entity.getHighPrice())
                .low(entity.getLowPrice())
                .close(entity.getClosePrice())
                .volume(entity.getVolume())
                .amount(entity.getAmount())
                .build();
    }

    private KlineData convertToEntity(KlineDataDto dto, String market, String symbol, String timeframe) {
        LocalDateTime klineTime = LocalDateTime.ofInstant(
                Instant.ofEpochSecond(dto.timestamp()), ZoneId.systemDefault());

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
}

