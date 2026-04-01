package com.koduck.service;

import com.koduck.dto.market.SectorNetFlowDto;

import java.time.LocalDate;

public interface MarketSectorNetFlowService {

    SectorNetFlowDto getLatest(String market, String indicator, int limitPerType);

    SectorNetFlowDto getByTradeDate(String market, String indicator, LocalDate tradeDate, int limitPerType);
}
