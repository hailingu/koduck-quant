package com.koduck.service.impl;
import com.koduck.controller.MarketController;
import com.koduck.entity.StockRealtime;
import com.koduck.repository.StockRealtimeRepository;
import com.koduck.service.PricePushService;
import com.koduck.service.StockSubscriptionService;
import com.koduck.service.SyntheticTickService;
import com.koduck.service.TickStreamService;
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
public class PricePushServiceImpl implements PricePushService {
    @org.springframework.beans.factory.annotation.Autowired
    private StockSubscriptionService stockSubscriptionService;
    @org.springframework.beans.factory.annotation.Autowired
    private StockRealtimeRepository stockRealtimeRepository;
    @org.springframework.beans.factory.annotation.Autowired
    private SyntheticTickService syntheticTickService;
    @org.springframework.beans.factory.annotation.Autowired
    private TickStreamService tickStreamService;
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
    @Override
    @Scheduled(fixedRate = 3000)
    public void checkAndPushPriceUpdates() {
        try {
            // 
            Set<String> symbolsToProcess = new HashSet<>(stockSubscriptionService.getAllSubscribedSymbols());
            symbolsToProcess.addAll(syntheticTickService.snapshotTrackedSymbols());
            if (symbolsToProcess.isEmpty()) {
                return;
            }
            // 
            List<StockRealtime> realtimeList = stockRealtimeRepository.findBySymbolIn(new ArrayList<>(symbolsToProcess));
            long now = System.currentTimeMillis();
            for (StockRealtime realtime : realtimeList) {
                String symbol = realtime.getSymbol();
                Double currentPrice = realtime.getPrice() != null ? realtime.getPrice().doubleValue() : null;
                Double lastPrice = currentPrice != null ? lastPrices.put(symbol, currentPrice) : lastPrices.get(symbol);
                boolean shouldPush = shouldPushAndMark(symbol, now);
                MarketController.TickDto syntheticTick = null;
                if (shouldPush) {
                    syntheticTick = syntheticTickService.appendSyntheticTickFromRealtime(realtime);
                    if (syntheticTick != null) {
                        tickStreamService.publishTick(symbol, syntheticTick);
                    }
                }
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
                    }
                    if (currentPrice != null) {
                        lastPrices.put(symbol, currentPrice);
                    }
                    continue;
                }
                // 
                boolean priceChanged = !Objects.equals(currentPrice, lastPrice);
                if ((priceChanged || syntheticTick != null) && shouldPush) {
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
                }
            }
        } catch (RuntimeException e) {
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
    /**
     * （）
     */
    @Override
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
    @Override
    public int getCachedPriceCount() {
        return lastPrices.size();
    }
}
