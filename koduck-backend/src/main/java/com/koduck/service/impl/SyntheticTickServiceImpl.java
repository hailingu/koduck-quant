package com.koduck.service.impl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.koduck.dto.market.TickDto;
import com.koduck.entity.StockRealtime;
import com.koduck.entity.StockTickHistory;
import com.koduck.repository.StockTickHistoryRepository;
import com.koduck.service.SyntheticTickService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Service implementation for generating synthetic tick data from real-time market data.
 *
 * @author Koduck Team
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SyntheticTickServiceImpl implements SyntheticTickService {

    /** The market timezone (Asia/Shanghai). */
    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Shanghai");

    /** Time formatter for tick timestamps (HH:mm:ss). */
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");

    /** Volume threshold for block orders (100,000). */
    private static final long BLOCK_ORDER_VOLUME_THRESHOLD = 100_000L;

    /** Flag indicating a block order. */
    private static final String FLAG_BLOCK_ORDER = "BLOCK_ORDER";

    /** Flag indicating a normal order. */
    private static final String FLAG_NORMAL = "NORMAL";

    /** Side indicator for buy orders. */
    private static final String SIDE_BUY = "buy";

    /** Side indicator for sell orders. */
    private static final String SIDE_SELL = "sell";

    /** Padding width for symbol formatting (6 digits). */
    private static final int SYMBOL_PADDING_WIDTH = 6;

    /** Repository for stock tick history data. */
    private final StockTickHistoryRepository stockTickHistoryRepository;

    /** Map tracking last cumulative volume per symbol. */
    private final Map<String, Long> lastCumulativeVolume = new ConcurrentHashMap<>();

    /** Map tracking last cumulative amount per symbol. */
    private final Map<String, BigDecimal> lastCumulativeAmount = new ConcurrentHashMap<>();

    /** Map tracking last price per symbol. */
    private final Map<String, BigDecimal> lastPrice = new ConcurrentHashMap<>();

    /** Set of symbols currently being tracked. */
    private final Set<String> trackedSymbols = ConcurrentHashMap.newKeySet();

    @Override
    public void trackSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return;
        }
        trackedSymbols.add(symbol.trim());
    }

    @Override
    public Set<String> snapshotTrackedSymbols() {
        return Set.copyOf(trackedSymbols);
    }

    @Override
    public TickDto appendSyntheticTickFromRealtime(StockRealtime realtime) {
        if (!isRealtimeValid(realtime)) {
            return null;
        }

        String symbol = realtime.getSymbol();
        Long currentVolume = realtime.getVolume();
        if (currentVolume == null || currentVolume <= 0) {
            return null;
        }

        Long previousVolume = lastCumulativeVolume.put(symbol, currentVolume);
        if (previousVolume == null) {
            initializeBaseline(symbol, realtime);
            return null;
        }

        long deltaVolume = currentVolume - previousVolume;
        if (deltaVolume <= 0) {
            refreshBaselineOnReset(symbol, realtime);
            return null;
        }

        return createOrMergeTick(symbol, realtime, deltaVolume);
    }

    private boolean isRealtimeValid(StockRealtime realtime) {
        return realtime != null && realtime.getSymbol() != null && realtime.getPrice() != null;
    }

    private void initializeBaseline(String symbol, StockRealtime realtime) {
        lastPrice.put(symbol, realtime.getPrice());
        if (realtime.getAmount() != null) {
            lastCumulativeAmount.put(symbol, realtime.getAmount());
        }
    }

    private void refreshBaselineOnReset(String symbol, StockRealtime realtime) {
        if (realtime.getAmount() != null) {
            lastCumulativeAmount.put(symbol, realtime.getAmount());
        }
        lastPrice.put(symbol, realtime.getPrice());
    }

    private TickDto createOrMergeTick(String symbol,
                                      StockRealtime realtime,
                                      long deltaVolume) {
        BigDecimal deltaAmount = computeDeltaAmount(symbol, realtime.getAmount(), deltaVolume, realtime.getPrice());
        LocalDateTime tickTime = LocalDateTime.now(MARKET_ZONE);
        BigDecimal currentPrice = realtime.getPrice();

        StockTickHistory lastTick = getLastTick(symbol);
        if (lastTick != null && lastTick.getPrice().compareTo(currentPrice) == 0) {
            return mergeWithLastTick(lastTick, symbol, currentPrice, deltaVolume, deltaAmount, tickTime);
        }

        return createNewTick(symbol, currentPrice, deltaVolume, deltaAmount, tickTime);
    }

    private StockTickHistory getLastTick(String symbol) {
        List<StockTickHistory> lastTicks = stockTickHistoryRepository
                .findBySymbolOrderByTickTimeDescIdDesc(symbol, PageRequest.of(0, 1));
        if (lastTicks.isEmpty()) {
            return null;
        }
        return lastTicks.get(0);
    }

    private TickDto mergeWithLastTick(StockTickHistory lastTick,
                                      String symbol,
                                      BigDecimal currentPrice,
                                      long deltaVolume,
                                      BigDecimal deltaAmount,
                                      LocalDateTime tickTime) {
        lastTick.setTickTime(tickTime);
        lastTick.setVolume(lastTick.getVolume() + deltaVolume);
        lastTick.setAmount(lastTick.getAmount().add(deltaAmount));
        StockTickHistory saved = stockTickHistoryRepository.save(lastTick);
        BigDecimal prevPrice = lastPrice.put(symbol, currentPrice);
        boolean isBuy = prevPrice == null || currentPrice.compareTo(prevPrice) >= 0;
        String flag = resolveFlag(saved.getVolume());
        return toTickDto(tickTime, saved.getPrice(), saved.getVolume(), saved.getAmount(), isBuy, flag);
    }

    private TickDto createNewTick(String symbol,
                                  BigDecimal currentPrice,
                                  long deltaVolume,
                                  BigDecimal deltaAmount,
                                  LocalDateTime tickTime) {
        StockTickHistory newTick = StockTickHistory.builder()
                .symbol(symbol)
                .tickTime(tickTime)
                .price(currentPrice)
                .volume(deltaVolume)
                .amount(deltaAmount)
                .createdAt(LocalDateTime.now(MARKET_ZONE))
                .build();
        StockTickHistory saved = stockTickHistoryRepository.save(
                Objects.requireNonNull(newTick, "newTick must not be null"));
        BigDecimal prevPrice = lastPrice.put(symbol, currentPrice);
        boolean isBuy = prevPrice == null || currentPrice.compareTo(prevPrice) >= 0;
        String flag = resolveFlag(deltaVolume);
        return toTickDto(tickTime, saved.getPrice(), deltaVolume, saved.getAmount(), isBuy, flag);
    }

    private TickDto toTickDto(LocalDateTime tickTime,
                              BigDecimal price,
                              long volume,
                              BigDecimal amount,
                              boolean isBuy,
                              String flag) {
        return new TickDto(
                tickTime.format(TIME_FORMATTER),
                price.doubleValue(),
                safeLongToInt(volume),
                amount == null ? 0D : amount.doubleValue(),
                isBuy ? SIDE_BUY : SIDE_SELL,
                flag,
                tickTime.atZone(MARKET_ZONE).toInstant().toEpochMilli()
        );
    }

    @Override
    public List<TickDto> getLatestTicks(String symbol, int limit) {
        // Try different symbol formats to handle leading zeros inconsistency
        List<String> symbolVariants = buildSymbolVariants(symbol);
        for (String variant : symbolVariants) {
            List<StockTickHistory> ticks = stockTickHistoryRepository
                    .findBySymbolOrderByTickTimeDescIdDesc(variant, PageRequest.of(0, limit));
            if (!ticks.isEmpty()) {
                return ticks.stream()
                        .map(this::toTickDto)
                        .toList();
            }
        }
        return List.of();
    }

    private List<String> buildSymbolVariants(String symbol) {
        List<String> variants = new ArrayList<>();
        if (symbol == null || symbol.isBlank()) {
            return variants;
        }
        String normalized = symbol.trim();
        variants.add(normalized);
        // For numeric symbols, try with/without leading zeros
        if (normalized.matches("\\d+")) {
            // Add version without leading zeros
            String noZeros = normalized.replaceFirst("^0+", "");
            if (!noZeros.isEmpty() && !noZeros.equals(normalized)) {
                variants.add(noZeros);
            }
            // Add 6-digit padded version
            if (normalized.length() <= SYMBOL_PADDING_WIDTH) {
                try {
                    String padded = String.format("%0" + SYMBOL_PADDING_WIDTH + "d", Integer.parseInt(normalized));
                    if (!padded.equals(normalized)) {
                        variants.add(padded);
                    }
                }
                catch (NumberFormatException _) {
                    // Ignore if number is too large
                }
            }
        }
        return variants;
    }

    private TickDto toTickDto(StockTickHistory row) {
        BigDecimal amount = row.getAmount() == null ? BigDecimal.ZERO : row.getAmount();
        String flag = resolveFlag(row.getVolume());
        return new TickDto(
                row.getTickTime().format(TIME_FORMATTER),
                row.getPrice().doubleValue(),
                safeNullableLongToInt(row.getVolume()),
                amount.doubleValue(),
                SIDE_BUY,
                flag,
                row.getTickTime().atZone(MARKET_ZONE).toInstant().toEpochMilli()
        );
    }

    private BigDecimal computeDeltaAmount(
            String symbol,
            BigDecimal currentAmount,
            long deltaVolume,
            BigDecimal currentPrice) {
        if (currentAmount != null) {
            BigDecimal previousAmount = lastCumulativeAmount.put(symbol, currentAmount);
            if (previousAmount != null) {
                BigDecimal delta = currentAmount.subtract(previousAmount);
                if (delta.compareTo(BigDecimal.ZERO) > 0) {
                    return delta;
                }
            }
        }
        return currentPrice.multiply(BigDecimal.valueOf(deltaVolume));
    }

    private String resolveFlag(Long volume) {
        if (volume != null && volume >= BLOCK_ORDER_VOLUME_THRESHOLD) {
            return FLAG_BLOCK_ORDER;
        }
        return FLAG_NORMAL;
    }

    private String resolveFlag(long volume) {
        return volume >= BLOCK_ORDER_VOLUME_THRESHOLD ? FLAG_BLOCK_ORDER : FLAG_NORMAL;
    }

    private int safeNullableLongToInt(Long volume) {
        if (volume == null) {
            return 0;
        }
        return safeLongToInt(volume);
    }

    private int safeLongToInt(long volume) {
        if (volume > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return (int) volume;
    }
}
