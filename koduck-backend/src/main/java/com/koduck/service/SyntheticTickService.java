package com.koduck.service;

import com.koduck.controller.MarketController;
import com.koduck.entity.StockRealtime;
import com.koduck.entity.StockTickHistory;
import com.koduck.repository.StockTickHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class SyntheticTickService {

    private static final ZoneId MARKET_ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");
    private static final long BLOCK_ORDER_VOLUME_THRESHOLD = 100_000L;

    private final StockTickHistoryRepository stockTickHistoryRepository;

    private final Map<String, Long> lastCumulativeVolume = new ConcurrentHashMap<>();
    private final Map<String, BigDecimal> lastCumulativeAmount = new ConcurrentHashMap<>();
    private final Map<String, BigDecimal> lastPrice = new ConcurrentHashMap<>();
    private final Set<String> trackedSymbols = ConcurrentHashMap.newKeySet();

    public void trackSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return;
        }
        trackedSymbols.add(symbol.trim());
    }

    public Set<String> snapshotTrackedSymbols() {
        return Set.copyOf(trackedSymbols);
    }

    public MarketController.TickDto appendSyntheticTickFromRealtime(StockRealtime realtime) {
        if (realtime == null || realtime.getSymbol() == null || realtime.getPrice() == null) {
            return null;
        }

        String symbol = realtime.getSymbol();
        Long currentVolume = realtime.getVolume();
        if (currentVolume == null || currentVolume <= 0) {
            return null;
        }

        Long previousVolume = lastCumulativeVolume.put(symbol, currentVolume);
        if (previousVolume == null) {
            // First snapshot: only establish baseline.
            lastPrice.put(symbol, realtime.getPrice());
            if (realtime.getAmount() != null) {
                lastCumulativeAmount.put(symbol, realtime.getAmount());
            }
            return null;
        }

        long deltaVolume = currentVolume - previousVolume;
        if (deltaVolume <= 0) {
            // Cross-day reset or stale snapshot.
            if (realtime.getAmount() != null) {
                lastCumulativeAmount.put(symbol, realtime.getAmount());
            }
            lastPrice.put(symbol, realtime.getPrice());
            return null;
        }

        BigDecimal deltaAmount = computeDeltaAmount(symbol, realtime.getAmount(), deltaVolume, realtime.getPrice());
        LocalDateTime tickTime = LocalDateTime.now(MARKET_ZONE);

        StockTickHistory saved = stockTickHistoryRepository.save(
                StockTickHistory.builder()
                        .symbol(symbol)
                        .tickTime(tickTime)
                        .price(realtime.getPrice())
                        .volume(deltaVolume)
                        .amount(deltaAmount)
                        .createdAt(LocalDateTime.now(MARKET_ZONE))
                        .build()
        );

        BigDecimal prevPrice = lastPrice.put(symbol, realtime.getPrice());
        boolean isBuy = prevPrice == null || realtime.getPrice().compareTo(prevPrice) >= 0;
        String flag = deltaVolume >= BLOCK_ORDER_VOLUME_THRESHOLD ? "BLOCK_ORDER" : "NORMAL";

        return new MarketController.TickDto(
                tickTime.format(TIME_FORMATTER),
                saved.getPrice().doubleValue(),
                deltaVolume > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) deltaVolume,
                saved.getAmount() == null ? 0D : saved.getAmount().doubleValue(),
                isBuy ? "buy" : "sell",
                flag,
                tickTime.atZone(MARKET_ZONE).toInstant().toEpochMilli()
        );
    }

    public List<MarketController.TickDto> getLatestTicks(String symbol, int limit) {
        return stockTickHistoryRepository
                .findBySymbolOrderByTickTimeDescIdDesc(symbol, PageRequest.of(0, limit))
                .stream()
                .map(this::toTickDto)
                .toList();
    }

    private MarketController.TickDto toTickDto(StockTickHistory row) {
        BigDecimal amount = row.getAmount() == null ? BigDecimal.ZERO : row.getAmount();
        String flag = row.getVolume() != null && row.getVolume() >= BLOCK_ORDER_VOLUME_THRESHOLD
                ? "BLOCK_ORDER"
                : "NORMAL";

        return new MarketController.TickDto(
                row.getTickTime().format(TIME_FORMATTER),
                row.getPrice().doubleValue(),
                row.getVolume() == null ? 0 : (row.getVolume() > Integer.MAX_VALUE ? Integer.MAX_VALUE : row.getVolume().intValue()),
                amount.doubleValue(),
                "buy",
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
}
