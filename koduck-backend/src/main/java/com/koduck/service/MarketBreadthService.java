package com.koduck.service;
import java.time.LocalDate;
import java.util.List;

import com.koduck.dto.market.DailyBreadthDto;

public interface MarketBreadthService {

    DailyBreadthDto getLatestDailyBreadth(String market, String breadthType);

    DailyBreadthDto getDailyBreadth(String market, String breadthType, LocalDate tradeDate);

    List<DailyBreadthDto> getDailyBreadthHistory(String market, String breadthType, LocalDate from, LocalDate to);
}
