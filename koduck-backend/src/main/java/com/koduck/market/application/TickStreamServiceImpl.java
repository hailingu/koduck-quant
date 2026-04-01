package com.koduck.market.application;

import com.koduck.dto.market.TickDto;
import com.koduck.service.TickStreamService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@Slf4j
public class TickStreamServiceImpl implements TickStreamService {

    private static final long SSE_TIMEOUT_MS = 0L;
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> emittersBySymbol = new ConcurrentHashMap<>();

    @Override
    public SseEmitter subscribe(String symbol) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emittersBySymbol.computeIfAbsent(symbol, key -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(symbol, emitter));
        emitter.onTimeout(() -> removeEmitter(symbol, emitter));
        emitter.onError(ex -> removeEmitter(symbol, emitter));

        try {
            Object readyPayload = Map.of("symbol", symbol);
            emitter.send(SseEmitter.event().name("ready")
                    .data(Objects.requireNonNull(readyPayload, "readyPayload must not be null")));
        } catch (IOException _) {
            removeEmitter(symbol, emitter);
        }
        return emitter;
    }

    @Override
    public void publishTick(String symbol, TickDto tick) {
        List<SseEmitter> emitters = emittersBySymbol.get(symbol);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                Object tickPayload = tick;
                emitter.send(SseEmitter.event().name("tick")
                        .data(Objects.requireNonNull(tickPayload, "tickPayload must not be null")));
            } catch (IOException _) {
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
