package com.koduck.service.impl;

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

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.koduck.dto.market.PriceUpdateDto;
import com.koduck.service.StockSubscriptionService;
import com.koduck.util.SymbolUtils;

import lombok.extern.slf4j.Slf4j;

/**
 * In-memory subscription registry and websocket push service.
 *
 * <p>Maintains user-symbol subscriptions and fan-outs price updates to subscribed users.</p>
 *
 * @author GitHub Copilot
 */
@Slf4j
@Service
public class StockSubscriptionServiceImpl implements StockSubscriptionService {

    /** WebSocket destination for price updates. */
    private static final String PRICE_QUEUE_DESTINATION = "/queue/price";

    /** Message type for price updates. */
    private static final String PRICE_UPDATE_TYPE = "PRICE_UPDATE";

    /** Messaging template for WebSocket communication. */
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Constructs a new StockSubscriptionServiceImpl.
     *
     * @param messagingTemplate the messaging template
     */
    public StockSubscriptionServiceImpl(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = Objects.requireNonNull(messagingTemplate,
                "messagingTemplate must not be null");
    }

    /**
     * User subscriptions map: userId -> Set<symbol>.
     */
    private final ConcurrentHashMap<Long, Set<String>> userSubscriptions = new ConcurrentHashMap<>();

    /**
     * Symbol subscribers map: symbol -> Set<userId>.
     */
    private final ConcurrentHashMap<String, Set<Long>> symbolSubscribers = new ConcurrentHashMap<>();

    /**
     * Subscribe user to stock symbols.
     *
     * @param userId the user ID
     * @param symbols the list of symbols to subscribe
     * @return the subscription result
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
                // Add to user subscriptions
                userSubList.add(normalizedSymbol);
                // Add to symbol subscribers
                symbolSubscribers.computeIfAbsent(normalizedSymbol, k -> ConcurrentHashMap.newKeySet())
                        .add(userId);
                successList.add(normalizedSymbol);
                log.debug("User {} subscribed to stock {}", userId, normalizedSymbol);
            }
            catch (Exception e) {
                failedMap.put(symbol, e.getMessage());
                log.warn("Failed to subscribe user {} to stock {}: {}", userId, symbol, e.getMessage());
            }
        }
        log.info("User {} subscription result: success={}, failed={}",
            userId, successList.size(), failedMap.size());
        return new SubscribeResult(successList, failedMap);
    }

    /**
     * Unsubscribe user from stock symbols.
     *
     * @param userId the user ID
     * @param symbols the list of symbols to unsubscribe
     * @return the unsubscription result
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

    /**
     * Unsubscribe user from all stocks.
     *
     * @param userId the user ID
     * @return the unsubscription result
     */
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

    /**
     * Unsubscribe user from specific symbols.
     *
     * @param userId the user ID
     * @param symbols the list of symbols to unsubscribe
     * @return the unsubscription result
     */
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
            }
            catch (Exception e) {
                failedMap.put(symbol, e.getMessage());
                log.warn("Failed to unsubscribe user {} from stock {}: {}", userId, symbol, e.getMessage());
            }
        }
        if (userSubList.isEmpty()) {
            userSubscriptions.remove(userId);
        }
        log.info("User {} unsubscription result: success={}, failed={}",
            userId, successList.size(), failedMap.size());
        return new SubscribeResult(successList, failedMap);
    }

    /**
     * Remove subscriber from symbol.
     *
     * @param userId the user ID
     * @param symbol the symbol
     */
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
     * Get subscribers for a symbol.
     *
     * @param symbol the symbol
     * @return set of subscriber user IDs
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
     * Get user subscriptions.
     *
     * @param userId the user ID
     * @return set of subscribed symbols
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
     * Get all subscribed symbols.
     *
     * @return set of all subscribed symbols
     */
    @Override
    public Set<String> getAllSubscribedSymbols() {
        return new HashSet<>(symbolSubscribers.keySet());
    }

    /**
     * Handle price update and send to subscribers.
     *
     * @param priceUpdate the price update
     */
    @Override
    public void onPriceUpdate(PriceUpdateDto priceUpdate) {
        if (priceUpdate == null || priceUpdate.symbol() == null) {
            log.warn("Invalid price update: {}", priceUpdate);
            return;
        }
        String symbol = normalizeSymbol(priceUpdate.symbol());
        if (symbol == null) {
            log.warn("Invalid symbol in price update: {}", priceUpdate.symbol());
            return;
        }
        Set<Long> subscribers = getSubscribers(symbol);
        if (subscribers.isEmpty()) {
            log.debug("No subscribers for symbol {}", symbol);
            return;
        }
        // Build price update message
        PriceUpdateMessage message = new PriceUpdateMessage();
        message.setType(PRICE_UPDATE_TYPE);
        message.setTimestamp(Instant.now().toString());
        message.setData(createPriceData(priceUpdate));
        // Send to all subscribers
        for (Long userId : subscribers) {
            try {
                // Send to /queue/user/<userId>/price
                String principal = Objects.requireNonNull(String.valueOf(userId),
                    "user principal must not be null");
                messagingTemplate.convertAndSendToUser(
                    principal,
                    PRICE_QUEUE_DESTINATION,
                    message
                );
                log.debug("Sent price update for {} to user {}", symbol, userId);
            }
            catch (Exception e) {
                log.error("Failed to send price update to user {}: {}", userId, e.getMessage());
            }
        }
        log.info("Price update for {} sent to {} subscribers", symbol, subscribers.size());
    }

    /**
     * Helper method to create PriceData from PriceUpdate.
     *
     * @param priceUpdate the price update
     * @return the price data
     */
    private PriceUpdateDto createPriceData(PriceUpdateDto priceUpdate) {
        return PriceUpdateDto.builder()
            .symbol(priceUpdate.symbol())
            .name(priceUpdate.name())
            .price(priceUpdate.price())
            .change(priceUpdate.change())
            .changePercent(priceUpdate.changePercent())
            .volume(priceUpdate.volume())
            .build();
    }

    /**
     * Handle user disconnect.
     *
     * @param userId the user ID
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
     * Normalize symbol.
     *
     * @param symbol the symbol to normalize
     * @return the normalized symbol
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
