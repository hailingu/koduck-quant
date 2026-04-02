package com.koduck.service;
import java.time.LocalDate;

import com.koduck.dto.market.SectorNetFlowDto;

public interface MarketSectorNetFlowService {

    SectorNetFlowDto getLatest(String market, String indicator, int limitPerType);

    SectorNetFlowDto getByTradeDate(String market, String indicator, LocalDate tradeDate, int limitPerType);
}
