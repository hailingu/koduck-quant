package com.koduck.service;

import com.koduck.controller.MarketController;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@Slf4j
public class TickStreamService {

    private static final long SSE_TIMEOUT_MS = 0L;
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> emittersBySymbol = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String symbol) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emittersBySymbol.computeIfAbsent(symbol, key -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(symbol, emitter));
        emitter.onTimeout(() -> removeEmitter(symbol, emitter));
        emitter.onError(ex -> removeEmitter(symbol, emitter));

        try {
            emitter.send(SseEmitter.event().name("ready").data(Map.of("symbol", symbol)));
        } catch (IOException ex) {
            removeEmitter(symbol, emitter);
        }
        return emitter;
    }

    public void publishTick(String symbol, MarketController.TickDto tick) {
        List<SseEmitter> emitters = emittersBySymbol.get(symbol);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("tick").data(tick));
            } catch (IOException ex) {
                removeEmitter(symbol, emitter);
            }
        }
    }

    private void removeEmitter(String symbol, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> emitters = emittersBySymbol.get(symbol);
        if (emitters == null) {
            return;
        }
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            emittersBySymbol.remove(symbol);
        }
    }
}

