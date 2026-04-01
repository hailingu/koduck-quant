package com.koduck.service;

import com.koduck.dto.market.DailyNetFlowDto;

import java.time.LocalDate;
import java.util.List;

public interface MarketFlowService {

    DailyNetFlowDto getLatestDailyNetFlow(String market, String flowType);

    DailyNetFlowDto getDailyNetFlow(String market, String flowType, LocalDate tradeDate);

    List<DailyNetFlowDto> getDailyNetFlowHistory(String market, String flowType, LocalDate from, LocalDate to);
}
