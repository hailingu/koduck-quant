package com.koduck.service;

import com.koduck.controller.MarketController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public interface TickStreamService {

    SseEmitter subscribe(String symbol);

    void publishTick(String symbol, MarketController.TickDto tick);
}
