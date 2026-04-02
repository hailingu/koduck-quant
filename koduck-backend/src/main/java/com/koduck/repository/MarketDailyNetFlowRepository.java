package com.koduck.repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.MarketDailyNetFlow;

@Repository
public interface MarketDailyNetFlowRepository extends JpaRepository<MarketDailyNetFlow, Long> {

    Optional<MarketDailyNetFlow> findFirstByMarketAndFlowTypeOrderByTradeDateDesc(String market, String flowType);

    Optional<MarketDailyNetFlow> findByMarketAndFlowTypeAndTradeDate(String market, String flowType, LocalDate tradeDate);

    List<MarketDailyNetFlow> findByMarketAndFlowTypeAndTradeDateBetweenOrderByTradeDateAsc(
            String market,
            String flowType,
            LocalDate from,
            LocalDate to
    );
}
