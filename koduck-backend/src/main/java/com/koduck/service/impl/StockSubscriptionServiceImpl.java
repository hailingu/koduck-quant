package com.koduck.service.impl;

import com.koduck.service.StockSubscriptionService;
import com.koduck.util.SymbolUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 
 *
 * <p>，</p>
 * <p>（ ConcurrentHashMap），：</p>
 * <ul>
 *   <li>-（userId -> Set<symbol>）</li>
 *   <li>（symbol -> Set<userId>）</li>
 *   <li></li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StockSubscriptionServiceImpl implements StockSubscriptionService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * : userId -> Set<symbol>
     */
    private final ConcurrentHashMap<Long, Set<String>> userSubscriptions = new ConcurrentHashMap<>();

    /**
     * : symbol -> Set<userId>
     */
    private final ConcurrentHashMap<String, Set<Long>> symbolSubscribers = new ConcurrentHashMap<>();

    /**
     * 
     *
     * @param userId  ID
     * @param symbols 
     * @return ，
     */
    @Override
    public SubscribeResult subscribe(Long userId, List<String> symbols) {
        if (userId == null || symbols == null || symbols.isEmpty()) {
            return SubscribeResult.failure(symbols, "Invalid parameters");
        }

        Set<String> userSubList = userSubscriptions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet());
        List<String> successList = new ArrayList<>();
        Map<String, String> failedMap = new HashMap<>();

        for (String symbol : symbols) {
            try {
                String normalizedSymbol = normalizeSymbol(symbol);
                if (normalizedSymbol == null) {
                    failedMap.put(symbol, "Invalid symbol format");
                    continue;
                }

                // 
                userSubList.add(normalizedSymbol);

                // 
                symbolSubscribers.computeIfAbsent(normalizedSymbol, k -> ConcurrentHashMap.newKeySet())
                        .add(userId);

                successList.add(normalizedSymbol);
                log.debug("User {} subscribed to stock {}", userId, normalizedSymbol);
            } catch (Exception e) {
                failedMap.put(symbol, e.getMessage());
                log.warn("Failed to subscribe user {} to stock {}: {}", userId, symbol, e.getMessage());
            }
        }

        log.info("User {} subscription result: success={}, failed={}", userId, successList.size(), failedMap.size());
        return new SubscribeResult(successList, failedMap);
    }

    /**
     * 
     *
     * @param userId  ID
     * @param symbols 
     * @return 
     */
    @Override
    public SubscribeResult unsubscribe(Long userId, List<String> symbols) {
        if (userId == null) {
            return SubscribeResult.failure(symbols != null ? symbols : Collections.emptyList(), "Invalid userId");
        }

        if (symbols == null || symbols.isEmpty()) {
            // 
            Set<String> userSubList = userSubscriptions.remove(userId);
            if (userSubList != null) {
                for (String symbol : userSubList) {
                    Set<Long> subscribers = symbolSubscribers.get(symbol);
                    if (subscribers != null) {
                        subscribers.remove(userId);
                        if (subscribers.isEmpty()) {
                            symbolSubscribers.remove(symbol);
                        }
                    }
                }
            }
            log.info("User {} unsubscribed from all stocks", userId);
            return new SubscribeResult(new ArrayList<>(userSubList), Collections.emptyMap());
        }

        Set<String> userSubList = userSubscriptions.get(userId);
        List<String> successList = new ArrayList<>();
        Map<String, String> failedMap = new HashMap<>();

        if (userSubList == null || userSubList.isEmpty()) {
            return SubscribeResult.failure(symbols, "No subscriptions found");
        }

        for (String symbol : symbols) {
            try {
                String normalizedSymbol = normalizeSymbol(symbol);
                if (normalizedSymbol == null) {
                    failedMap.put(symbol, "Invalid symbol format");
                    continue;
                }

                // 
                userSubList.remove(normalizedSymbol);

                // 
                Set<Long> subscribers = symbolSubscribers.get(normalizedSymbol);
                if (subscribers != null) {
                    subscribers.remove(userId);
                    if (subscribers.isEmpty()) {
                        symbolSubscribers.remove(normalizedSymbol);
                    }
                }

                successList.add(normalizedSymbol);
                log.debug("User {} unsubscribed from stock {}", userId, normalizedSymbol);
            } catch (Exception e) {
                failedMap.put(symbol, e.getMessage());
                log.warn("Failed to unsubscribe user {} from stock {}: {}", userId, symbol, e.getMessage());
            }
        }

        // ，
        if (userSubList.isEmpty()) {
            userSubscriptions.remove(userId);
        }

        log.info("User {} unsubscription result: success={}, failed={}", userId, successList.size(), failedMap.size());
        return new SubscribeResult(successList, failedMap);
    }

    /**
     * ID
     *
     * @param symbol 
     * @return ID
     */
    @Override
    public Set<Long> getSubscribers(String symbol) {
        if (symbol == null) {
            return Collections.emptySet();
        }
        String normalizedSymbol = normalizeSymbol(symbol);
        if (normalizedSymbol == null) {
            return Collections.emptySet();
        }
        return symbolSubscribers.getOrDefault(normalizedSymbol, Collections.emptySet());
    }

    /**
     * 
     *
     * @param userId ID
     * @return 
     */
    @Override
    public Set<String> getUserSubscriptions(Long userId) {
        if (userId == null) {
            return Collections.emptySet();
        }
        Set<String> subscriptions = userSubscriptions.get(userId);
        return subscriptions != null ? new HashSet<>(subscriptions) : Collections.emptySet();
    }

    /**
     * 
     *
     * @return 
     */
    @Override
    public Set<String> getAllSubscribedSymbols() {
        return new HashSet<>(symbolSubscribers.keySet());
    }

    /**
     * ，
     *
     * @param priceUpdate 
     */
    @Override
    public void onPriceUpdate(PriceUpdate priceUpdate) {
        if (priceUpdate == null || priceUpdate.getSymbol() == null) {
            log.warn("Invalid price update: {}", priceUpdate);
            return;
        }

        String symbol = normalizeSymbol(priceUpdate.getSymbol());
        if (symbol == null) {
            log.warn("Invalid symbol in price update: {}", priceUpdate.getSymbol());
            return;
        }

        Set<Long> subscribers = getSubscribers(symbol);
        if (subscribers.isEmpty()) {
            log.debug("No subscribers for symbol {}", symbol);
            return;
        }

        // 
        PriceUpdateMessage message = PriceUpdateMessage.builder()
                .type("PRICE_UPDATE")
                .timestamp(Instant.now().toString())
                .data(createPriceData(priceUpdate))
                .build();

        // 
        for (Long userId : subscribers) {
            try {
                //  /queue/user/<userId>/price 
                messagingTemplate.convertAndSendToUser(
                        userId.toString(),
                        "/queue/price",
                        message
                );
                log.debug("Sent price update for {} to user {}", symbol, userId);
            } catch (Exception e) {
                log.error("Failed to send price update to user {}: {}", userId, e.getMessage());
            }
        }

        log.info("Price update for {} sent to {} subscribers", symbol, subscribers.size());
    }

    /**
     * Helper method to create PriceData from PriceUpdate
     */
    private PriceUpdateMessage.PriceData createPriceData(PriceUpdate priceUpdate) {
        PriceUpdateMessage.PriceData data = new PriceUpdateMessage.PriceData();
        data.setSymbol(priceUpdate.getSymbol());
        data.setName(priceUpdate.getName());
        data.setPrice(priceUpdate.getPrice());
        data.setChange(priceUpdate.getChange());
        data.setChangePercent(priceUpdate.getChangePercent());
        data.setVolume(priceUpdate.getVolume());
        return data;
    }

    /**
     * 
     *
     * @param userId ID
     */
    @Override
    public void onUserDisconnect(Long userId) {
        if (userId == null) {
            return;
        }

        // 
        unsubscribe(userId, Collections.emptyList());
        log.info("Cleaned up subscriptions for disconnected user {}", userId);
    }

    /**
     * 
     *
     * @param symbol 
     * @return 
     */
    private String normalizeSymbol(String symbol) {
        if (symbol == null || symbol.isBlank()) {
            return null;
        }

        String normalized = SymbolUtils.normalize(symbol);
        if (normalized == null || normalized.isBlank()) {
            return null;
        }

        return normalized;
    }
}
