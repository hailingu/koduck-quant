package com.koduck.repository;

import com.koduck.entity.MarketSectorNetFlow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface MarketSectorNetFlowRepository extends JpaRepository<MarketSectorNetFlow, Long> {

    Optional<MarketSectorNetFlow> findFirstByMarketAndIndicatorOrderByTradeDateDesc(String market, String indicator);

    List<MarketSectorNetFlow> findByMarketAndIndicatorAndTradeDate(String market, String indicator, LocalDate tradeDate);
}
