package com.koduck.service.impl;

import com.koduck.service.StockSubscriptionService;
import com.koduck.util.SymbolUtils;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * In-memory subscription registry and websocket push service.
 *
 * <p>Maintains user-symbol subscriptions and fan-outs price updates to subscribed users.</p>
 *
 * @author GitHub Copilot
 * @date 2026-03-31
 */
@Slf4j
@Service
public class StockSubscriptionServiceImpl implements StockSubscriptionService {

    private static final String PRICE_QUEUE_DESTINATION = "/queue/price";
    private static final String PRICE_UPDATE_TYPE = "PRICE_UPDATE";

    private final SimpMessagingTemplate messagingTemplate;

    public StockSubscriptionServiceImpl(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = Objects.requireNonNull(messagingTemplate,
                "messagingTemplate must not be null");
    }

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
            return SubscribeResult.failure(symbols == null ? List.of() : symbols, "Invalid parameters");
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
            return unsubscribeAll(userId);
        }
        return unsubscribeSymbols(userId, symbols);
    }
    private SubscribeResult unsubscribeAll(Long userId) {
        Set<String> userSubList = userSubscriptions.remove(userId);
        if (userSubList != null) {
            for (String symbol : userSubList) {
                removeSubscriberFromSymbol(userId, symbol);
            }
        }
        List<String> successList = userSubList == null ? List.of() : new ArrayList<>(userSubList);
        log.info("User {} unsubscribed from all stocks", userId);
        return new SubscribeResult(successList, Collections.emptyMap());
    }
    private SubscribeResult unsubscribeSymbols(Long userId, List<String> symbols) {
        Set<String> userSubList = userSubscriptions.get(userId);
        if (userSubList == null || userSubList.isEmpty()) {
            return SubscribeResult.failure(symbols, "No subscriptions found");
        }
        List<String> successList = new ArrayList<>();
        Map<String, String> failedMap = new HashMap<>();
        for (String symbol : symbols) {
            try {
                String normalizedSymbol = normalizeSymbol(symbol);
                if (normalizedSymbol == null) {
                    failedMap.put(symbol, "Invalid symbol format");
                    continue;
                }
                userSubList.remove(normalizedSymbol);
                removeSubscriberFromSymbol(userId, normalizedSymbol);
                successList.add(normalizedSymbol);
                log.debug("User {} unsubscribed from stock {}", userId, normalizedSymbol);
            } catch (Exception e) {
                failedMap.put(symbol, e.getMessage());
                log.warn("Failed to unsubscribe user {} from stock {}: {}", userId, symbol, e.getMessage());
            }
        }
        if (userSubList.isEmpty()) {
            userSubscriptions.remove(userId);
        }
        log.info("User {} unsubscription result: success={}, failed={}", userId, successList.size(), failedMap.size());
        return new SubscribeResult(successList, failedMap);
    }
    private void removeSubscriberFromSymbol(Long userId, String symbol) {
        Set<Long> subscribers = symbolSubscribers.get(symbol);
        if (subscribers == null) {
            return;
        }
        subscribers.remove(userId);
        if (subscribers.isEmpty()) {
            symbolSubscribers.remove(symbol);
        }
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
        Set<Long> subscribers = symbolSubscribers.get(normalizedSymbol);
        return subscribers == null ? Collections.emptySet() : new HashSet<>(subscribers);
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
        PriceUpdateMessage message = new PriceUpdateMessage();
        message.setType(PRICE_UPDATE_TYPE);
        message.setTimestamp(Instant.now().toString());
        message.setData(createPriceData(priceUpdate));
        // 
        for (Long userId : subscribers) {
            try {
                //  /queue/user/<userId>/price 
                messagingTemplate.convertAndSendToUser(
                        String.valueOf(userId),
                        PRICE_QUEUE_DESTINATION,
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
