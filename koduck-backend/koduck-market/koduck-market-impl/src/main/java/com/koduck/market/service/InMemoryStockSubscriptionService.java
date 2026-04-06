package com.koduck.market.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.koduck.market.dto.PriceUpdateDto;

/**
 * 内存版股票订阅服务实现。
 *
 * <p>用于本地/开发环境提供基础订阅能力，保证 WebSocket 订阅链路可用。</p>
 */
@Service
public class InMemoryStockSubscriptionService implements StockSubscriptionService {

    private final Map<Long, Set<String>> userToSymbols = new ConcurrentHashMap<>();
    private final Map<String, Set<Long>> symbolToUsers = new ConcurrentHashMap<>();

    @Override
    public SubscribeResult subscribe(Long userId, List<String> symbols) {
        if (userId == null) {
            return SubscribeResult.failure(symbols, "userId must not be null");
        }
        if (symbols == null || symbols.isEmpty()) {
            return new SubscribeResult(List.of(), Map.of());
        }

        List<String> success = new ArrayList<>();
        Map<String, String> failed = new ConcurrentHashMap<>();

        for (String raw : symbols) {
            String symbol = normalizeSymbol(raw);
            if (symbol == null) {
                failed.put(String.valueOf(raw), "symbol must not be blank");
                continue;
            }
            userToSymbols.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet()).add(symbol);
            symbolToUsers.computeIfAbsent(symbol, ignored -> ConcurrentHashMap.newKeySet()).add(userId);
            success.add(symbol);
        }

        return new SubscribeResult(success, failed);
    }

    @Override
    public SubscribeResult unsubscribe(Long userId, List<String> symbols) {
        if (userId == null) {
            return SubscribeResult.failure(symbols, "userId must not be null");
        }
        if (symbols == null || symbols.isEmpty()) {
            return new SubscribeResult(List.of(), Map.of());
        }

        List<String> success = new ArrayList<>();
        Map<String, String> failed = new ConcurrentHashMap<>();

        Set<String> current = userToSymbols.getOrDefault(userId, Collections.emptySet());
        for (String raw : symbols) {
            String symbol = normalizeSymbol(raw);
            if (symbol == null) {
                failed.put(String.valueOf(raw), "symbol must not be blank");
                continue;
            }
            if (!current.contains(symbol)) {
                failed.put(symbol, "not subscribed");
                continue;
            }
            current.remove(symbol);
            Set<Long> users = symbolToUsers.get(symbol);
            if (users != null) {
                users.remove(userId);
                if (users.isEmpty()) {
                    symbolToUsers.remove(symbol);
                }
            }
            success.add(symbol);
        }

        if (current.isEmpty()) {
            userToSymbols.remove(userId);
        }

        return new SubscribeResult(success, failed);
    }

    @Override
    public Set<Long> getSubscribers(String symbol) {
        String normalized = normalizeSymbol(symbol);
        if (normalized == null) {
            return Set.of();
        }
        return Set.copyOf(symbolToUsers.getOrDefault(normalized, Collections.emptySet()));
    }

    @Override
    public Set<String> getUserSubscriptions(Long userId) {
        if (userId == null) {
            return Set.of();
        }
        return Set.copyOf(userToSymbols.getOrDefault(userId, Collections.emptySet()));
    }

    @Override
    public Set<String> getAllSubscribedSymbols() {
        return Set.copyOf(symbolToUsers.keySet());
    }

    @Override
    public void onPriceUpdate(PriceUpdateDto priceUpdate) {
        // 当前内存实现仅维护订阅关系，不负责推送分发。
    }

    @Override
    public void onUserDisconnect(Long userId) {
        if (userId == null) {
            return;
        }
        Set<String> symbols = userToSymbols.remove(userId);
        if (symbols == null || symbols.isEmpty()) {
            return;
        }
        for (String symbol : symbols) {
            Set<Long> users = symbolToUsers.get(symbol);
            if (users == null) {
                continue;
            }
            users.remove(userId);
            if (users.isEmpty()) {
                symbolToUsers.remove(symbol);
            }
        }
    }

    private String normalizeSymbol(String symbol) {
        if (symbol == null) {
            return null;
        }
        String normalized = symbol.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.toUpperCase(Locale.ROOT);
    }
}
