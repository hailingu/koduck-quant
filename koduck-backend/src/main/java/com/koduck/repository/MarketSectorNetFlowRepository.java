package com.koduck.repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.MarketSectorNetFlow;

@Repository
public interface MarketSectorNetFlowRepository extends JpaRepository<MarketSectorNetFlow, Long> {

    Optional<MarketSectorNetFlow> findFirstByMarketAndIndicatorOrderByTradeDateDesc(String market, String indicator);

    List<MarketSectorNetFlow> findByMarketAndIndicatorAndTradeDate(String market, String indicator, LocalDate tradeDate);
}
