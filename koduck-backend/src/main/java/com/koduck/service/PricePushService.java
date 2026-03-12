package com.koduck.service;

import com.koduck.entity.StockRealtime;
import com.koduck.repository.StockRealtimeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 
 *
 * <p></p>
 * <p>：</p>
 * <ul>
 *   <li></li>
 *   <li></li>
 *   <li>（）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PricePushService {

    private final StockSubscriptionService stockSubscriptionService;
    private final StockRealtimeRepository stockRealtimeRepository;

    /**
     * ：symbol -> last price
     */
    private final ConcurrentHashMap<String, Double> lastPrices = new ConcurrentHashMap<>();

    /**
     * ：symbol -> timestamp
     */
    private final ConcurrentHashMap<String, Long> lastPushTime = new ConcurrentHashMap<>();

    /**
     * （）， 5 
     */
    private static final long PUSH_INTERVAL_MS = 5000;

    /**
     * ， 0.01%（）
     */
    private static final double PRICE_CHANGE_THRESHOLD = 0.0001;

    /**
     * 
     *  3 
     */
    @Scheduled(fixedRate = 3000)
    public void checkAndPushPriceUpdates() {
        try {
            // 
            Set<String> subscribedSymbols = stockSubscriptionService.getAllSubscribedSymbols();
            if (subscribedSymbols.isEmpty()) {
                return;
            }

            // 
            List<StockRealtime> realtimeList = stockRealtimeRepository.findBySymbolIn(new ArrayList<>(subscribedSymbols));

            long now = System.currentTimeMillis();

            for (StockRealtime realtime : realtimeList) {
                String symbol = realtime.getSymbol();
                Double currentPrice = realtime.getPrice() != null ? realtime.getPrice().doubleValue() : null;
                Double lastPrice = lastPrices.get(symbol);

                boolean shouldPush = shouldPush(symbol, now);

                // Push initial snapshot immediately for new subscriptions.
                if (lastPrice == null) {
                    if (currentPrice != null && shouldPush) {
                        StockSubscriptionService.PriceUpdate initialUpdate = StockSubscriptionService.PriceUpdate.builder()
                                .symbol(realtime.getSymbol())
                                .name(realtime.getName())
                                .price(currentPrice)
                                .change(realtime.getChangeAmount() != null ? realtime.getChangeAmount().doubleValue() : null)
                                .changePercent(realtime.getChangePercent() != null ? realtime.getChangePercent().doubleValue() : null)
                                .volume(realtime.getVolume())
                                .build();

                        stockSubscriptionService.onPriceUpdate(initialUpdate);
                        lastPushTime.put(symbol, now);
                    }

                    if (currentPrice != null) {
                        lastPrices.put(symbol, currentPrice);
                    }
                    continue;
                }

                // 
                boolean priceChanged = !Objects.equals(currentPrice, lastPrice);

                if (priceChanged && shouldPush) {
                    // 
                    StockSubscriptionService.PriceUpdate priceUpdate = StockSubscriptionService.PriceUpdate.builder()
                            .symbol(realtime.getSymbol())
                            .name(realtime.getName())
                            .price(currentPrice)
                            .change(realtime.getChangeAmount() != null ? realtime.getChangeAmount().doubleValue() : null)
                            .changePercent(realtime.getChangePercent() != null ? realtime.getChangePercent().doubleValue() : null)
                            .volume(realtime.getVolume())
                            .build();

                    stockSubscriptionService.onPriceUpdate(priceUpdate);

                    // 
                    lastPushTime.put(symbol, now);
                }

                // 
                if (currentPrice != null) {
                    lastPrices.put(symbol, currentPrice);
                }
            }
        } catch (Exception e) {
            log.error(": {}", e.getMessage(), e);
        }
    }

    /**
     * 
     *
     * @param symbol 
     * @param now   
     * @return 
     */
    private boolean shouldPush(String symbol, long now) {
        Long lastPush = lastPushTime.get(symbol);
        if (lastPush == null) {
            return true;
        }
        return now - lastPush >= PUSH_INTERVAL_MS;
    }

    /**
     * （）
     */
    public void clearCache() {
        lastPrices.clear();
        lastPushTime.clear();
        log.info("");
    }

    /**
     * 
     *
     * @return 
     */
    public int getCachedPriceCount() {
        return lastPrices.size();
    }
}
