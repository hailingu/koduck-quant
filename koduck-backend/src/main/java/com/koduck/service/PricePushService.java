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
 * 价格推送服务
 *
 * <p>定期检查股票价格变动并推送给订阅者。</p>
 * <p>功能：</p>
 * <ul>
 *   <li>定期轮询关注的股票价格</li>
 *   <li>检测价格变动并推送更新</li>
 *   <li>推送频率控制（节流）</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PricePushService {

    private final StockSubscriptionService stockSubscriptionService;
    private final StockRealtimeRepository stockRealtimeRepository;

    /**
     * 价格缓存：symbol -> last price
     */
    private final ConcurrentHashMap<String, Double> lastPrices = new ConcurrentHashMap<>();

    /**
     * 上次推送时间：symbol -> timestamp
     */
    private final ConcurrentHashMap<String, Long> lastPushTime = new ConcurrentHashMap<>();

    /**
     * 推送间隔（毫秒），默认 5 秒
     */
    private static final long PUSH_INTERVAL_MS = 5000;

    /**
     * 价格变动阈值，默认 0.01%（百分之一）
     */
    private static final double PRICE_CHANGE_THRESHOLD = 0.0001;

    /**
     * 定期检查并推送价格变动
     * 每 3 秒执行一次
     */
    @Scheduled(fixedRate = 3000)
    public void checkAndPushPriceUpdates() {
        try {
            // 获取所有被订阅的股票
            Set<String> subscribedSymbols = stockSubscriptionService.getAllSubscribedSymbols();
            if (subscribedSymbols.isEmpty()) {
                return;
            }

            // 批量获取这些股票的实时价格
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

                // 检查价格是否变动
                boolean priceChanged = !Objects.equals(currentPrice, lastPrice);

                if (priceChanged && shouldPush) {
                    // 构建价格更新并推送
                    StockSubscriptionService.PriceUpdate priceUpdate = StockSubscriptionService.PriceUpdate.builder()
                            .symbol(realtime.getSymbol())
                            .name(realtime.getName())
                            .price(currentPrice)
                            .change(realtime.getChangeAmount() != null ? realtime.getChangeAmount().doubleValue() : null)
                            .changePercent(realtime.getChangePercent() != null ? realtime.getChangePercent().doubleValue() : null)
                            .volume(realtime.getVolume())
                            .build();

                    stockSubscriptionService.onPriceUpdate(priceUpdate);

                    // 更新上次推送时间
                    lastPushTime.put(symbol, now);
                }

                // 更新价格缓存
                if (currentPrice != null) {
                    lastPrices.put(symbol, currentPrice);
                }
            }
        } catch (Exception e) {
            log.error("价格推送检查失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 判断是否应该推送
     *
     * @param symbol 股票代码
     * @param now   当前时间戳
     * @return 是否应该推送
     */
    private boolean shouldPush(String symbol, long now) {
        Long lastPush = lastPushTime.get(symbol);
        if (lastPush == null) {
            return true;
        }
        return now - lastPush >= PUSH_INTERVAL_MS;
    }

    /**
     * 清理缓存（用于测试或重置）
     */
    public void clearCache() {
        lastPrices.clear();
        lastPushTime.clear();
        log.info("价格缓存已清理");
    }

    /**
     * 获取缓存的价格数量
     *
     * @return 缓存的股票数量
     */
    public int getCachedPriceCount() {
        return lastPrices.size();
    }
}
