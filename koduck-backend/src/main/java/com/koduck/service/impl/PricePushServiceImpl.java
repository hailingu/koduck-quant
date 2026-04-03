package com.koduck.service.impl;

import com.koduck.dto.market.PriceUpdateDto;
import com.koduck.dto.market.RealtimePriceEventMessage;
import com.koduck.dto.market.TickDto;
import com.koduck.entity.StockRealtime;
import com.koduck.service.PricePushService;
import com.koduck.service.StockSubscriptionService;
import com.koduck.service.SyntheticTickService;
import com.koduck.service.TickStreamService;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import com.koduck.util.SymbolUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Pushes subscribed stock price updates to websocket subscribers.
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Slf4j
@Service
public class PricePushServiceImpl implements PricePushService {

    private final StockSubscriptionService stockSubscriptionService;
    private final SyntheticTickService syntheticTickService;
    private final TickStreamService tickStreamService;

    private final ConcurrentHashMap<String, Double> lastPrices = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastPushTime = new ConcurrentHashMap<>();

    private static final long PUSH_INTERVAL_MS = 5000L;

    public PricePushServiceImpl(StockSubscriptionService stockSubscriptionService,
                                SyntheticTickService syntheticTickService,
                                TickStreamService tickStreamService) {
        this.stockSubscriptionService = stockSubscriptionService;
        this.syntheticTickService = syntheticTickService;
        this.tickStreamService = tickStreamService;
    }

    @Override
    public void checkAndPushPriceUpdates() {
        // Polling is disabled after RabbitMQ event-driven migration.
        log.debug("checkAndPushPriceUpdates is disabled; expecting RabbitMQ realtime events");
    }

    @Override
    public void onRealtimePriceEvent(RealtimePriceEventMessage event) {
        if (event == null || event.getSymbol() == null || event.getSymbol().isBlank()) {
            return;
        }
        String symbol = normalizeSymbol(event.getSymbol());
        if (symbol == null) {
            return;
        }
        if (!isActiveSymbol(symbol)) {
            return;
        }
        long now = System.currentTimeMillis();
        StockRealtime realtime = toRealtime(event, symbol);
        Double currentPrice = extractCurrentPrice(realtime);
        Double lastPrice = getAndUpdateLastPrice(symbol, currentPrice);
        boolean shouldPush = shouldPushAndMark(symbol, now);
        TickDto syntheticTick = appendAndPublishSyntheticTick(realtime, symbol, shouldPush);

        if (handleInitialSnapshotIfNeeded(realtime, symbol, currentPrice, lastPrice, shouldPush)) {
            return;
        }

        if (shouldPushRegularUpdate(currentPrice, lastPrice, syntheticTick, shouldPush)) {
            stockSubscriptionService.onPriceUpdate(buildPriceUpdate(realtime, currentPrice));
        }
    }

    private Double extractCurrentPrice(StockRealtime realtime) {
        return realtime.getPrice() != null ? realtime.getPrice().doubleValue() : null;
    }

    private Double getAndUpdateLastPrice(String symbol, Double currentPrice) {
        if (currentPrice != null) {
            return lastPrices.put(symbol, currentPrice);
        }
        return lastPrices.get(symbol);
    }

    private TickDto appendAndPublishSyntheticTick(StockRealtime realtime, String symbol, boolean shouldPush) {
        if (!shouldPush) {
            return null;
        }
        TickDto syntheticTick = syntheticTickService.appendSyntheticTickFromRealtime(realtime);
        if (syntheticTick != null) {
            tickStreamService.publishTick(symbol, syntheticTick);
        }
        return syntheticTick;
    }

    private boolean handleInitialSnapshotIfNeeded(StockRealtime realtime,
                                                  String symbol,
                                                  Double currentPrice,
                                                  Double lastPrice,
                                                  boolean shouldPush) {
        if (lastPrice != null) {
            return false;
        }

        if (currentPrice != null && shouldPush) {
            stockSubscriptionService.onPriceUpdate(buildPriceUpdate(realtime, currentPrice));
        }
        if (currentPrice != null) {
            lastPrices.put(symbol, currentPrice);
        }
        return true;
    }

    private boolean shouldPushRegularUpdate(Double currentPrice,
                                            Double lastPrice,
                                            TickDto syntheticTick,
                                            boolean shouldPush) {
        if (!shouldPush) {
            return false;
        }
        boolean priceChanged = !Objects.equals(currentPrice, lastPrice);
        return priceChanged || syntheticTick != null;
    }

    private PriceUpdateDto buildPriceUpdate(StockRealtime realtime, Double currentPrice) {
        return PriceUpdateDto.builder()
                .symbol(realtime.getSymbol())
                .name(realtime.getName())
                .price(currentPrice)
                .change(realtime.getChangeAmount() != null ? realtime.getChangeAmount().doubleValue() : null)
                .changePercent(realtime.getChangePercent() != null ? realtime.getChangePercent().doubleValue() : null)
                .volume(realtime.getVolume())
                .build();
    }

    private boolean isActiveSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return false;
        }
        Set<String> subscribedSymbols = stockSubscriptionService.getAllSubscribedSymbols();
        if (subscribedSymbols.contains(symbol)) {
            return true;
        }
        return syntheticTickService.snapshotTrackedSymbols().contains(symbol);
    }

    private StockRealtime toRealtime(RealtimePriceEventMessage event, String normalizedSymbol) {
        return StockRealtime.builder()
                .symbol(normalizedSymbol)
                .name(event.getName() != null && !event.getName().isBlank() ? event.getName() : normalizedSymbol)
                .type(event.getType() != null ? event.getType() : "STOCK")
                .price(event.getPrice())
                .changeAmount(event.getChangeAmount())
                .changePercent(event.getChangePercent())
                .volume(event.getVolume())
                .amount(event.getAmount())
                .build();
    }

    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return null;
        }
        String normalized = SymbolUtils.normalize(symbol);
        return normalized == null || normalized.isBlank() ? null : normalized;
    }

    private boolean shouldPushAndMark(String symbol, long now) {
        final boolean[] shouldPushHolder = {false};
        lastPushTime.compute(symbol, (key, lastPush) -> {
            if (lastPush == null || now - lastPush >= PUSH_INTERVAL_MS) {
                shouldPushHolder[0] = true;
                return now;
            }
            return lastPush;
        });
        return shouldPushHolder[0];
    }

    @Override
    public void clearCache() {
        lastPrices.clear();
        lastPushTime.clear();
        log.info("Price push caches cleared");
    }

    @Override
    public int getCachedPriceCount() {
        return lastPrices.size();
    }
}
