package com.koduck.market.service;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.koduck.market.dto.TickDto;

public interface TickStreamService {

    SseEmitter subscribe(String symbol);

    void publishTick(String symbol, TickDto tick);
}
