package com.koduck.service;

import com.koduck.dto.market.DailyBreadthDto;

import java.time.LocalDate;
import java.util.List;

public interface MarketBreadthService {

    DailyBreadthDto getLatestDailyBreadth(String market, String breadthType);

    DailyBreadthDto getDailyBreadth(String market, String breadthType, LocalDate tradeDate);

    List<DailyBreadthDto> getDailyBreadthHistory(String market, String breadthType, LocalDate from, LocalDate to);
}
