package com.koduck.service;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.koduck.dto.market.TickDto;

public interface TickStreamService {

    SseEmitter subscribe(String symbol);

    void publishTick(String symbol, TickDto tick);
}
