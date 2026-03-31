package com.koduck.service.impl;

import com.koduck.dto.market.TickDto;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.StockRealtimeRepository;
import com.koduck.service.PricePushService;
import com.koduck.service.StockSubscriptionService;
import com.koduck.service.SyntheticTickService;
import com.koduck.service.TickStreamService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
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
    private final StockRealtimeRepository stockRealtimeRepository;
    private final SyntheticTickService syntheticTickService;
    private final TickStreamService tickStreamService;

    private final ConcurrentHashMap<String, Double> lastPrices = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastPushTime = new ConcurrentHashMap<>();

    private static final long PUSH_INTERVAL_MS = 5000L;

    public PricePushServiceImpl(StockSubscriptionService stockSubscriptionService,
                                StockRealtimeRepository stockRealtimeRepository,
                                SyntheticTickService syntheticTickService,
                                TickStreamService tickStreamService) {
        this.stockSubscriptionService = stockSubscriptionService;
        this.stockRealtimeRepository = stockRealtimeRepository;
        this.syntheticTickService = syntheticTickService;
        this.tickStreamService = tickStreamService;
    }

    @Override
    @Scheduled(fixedRate = 3000)
    public void checkAndPushPriceUpdates() {
        try {
            Set<String> symbolsToProcess = collectSymbolsToProcess();
            if (symbolsToProcess.isEmpty()) {
                return;
            }
            processRealtimeSnapshots(symbolsToProcess, System.currentTimeMillis());
        } catch (RuntimeException e) {
            log.error("Failed to push price updates: {}", e.getMessage(), e);
        }
    }

    private Set<String> collectSymbolsToProcess() {
        Set<String> symbolsToProcess = new HashSet<>(stockSubscriptionService.getAllSubscribedSymbols());
        symbolsToProcess.addAll(syntheticTickService.snapshotTrackedSymbols());
        return symbolsToProcess;
    }

    private void processRealtimeSnapshots(Set<String> symbolsToProcess, long now) {
        List<StockRealtime> realtimeList = stockRealtimeRepository.findBySymbolIn(new ArrayList<>(symbolsToProcess));
        for (StockRealtime realtime : realtimeList) {
            processSingleRealtime(realtime, now);
        }
    }

    private void processSingleRealtime(StockRealtime realtime, long now) {
        String symbol = realtime.getSymbol();
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

    private StockSubscriptionService.PriceUpdate buildPriceUpdate(StockRealtime realtime, Double currentPrice) {
        return StockSubscriptionService.PriceUpdate.builder()
                .symbol(realtime.getSymbol())
                .name(realtime.getName())
                .price(currentPrice)
                .change(realtime.getChangeAmount() != null ? realtime.getChangeAmount().doubleValue() : null)
                .changePercent(realtime.getChangePercent() != null ? realtime.getChangePercent().doubleValue() : null)
                .volume(realtime.getVolume())
                .build();
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
