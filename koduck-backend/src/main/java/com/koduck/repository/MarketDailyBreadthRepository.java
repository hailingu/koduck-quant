package com.koduck.repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.MarketDailyBreadth;

@Repository
public interface MarketDailyBreadthRepository extends JpaRepository<MarketDailyBreadth, Long> {

    Optional<MarketDailyBreadth> findFirstByMarketAndBreadthTypeOrderByTradeDateDesc(String market, String breadthType);

    Optional<MarketDailyBreadth> findByMarketAndBreadthTypeAndTradeDate(String market, String breadthType, LocalDate tradeDate);

    List<MarketDailyBreadth> findByMarketAndBreadthTypeAndTradeDateBetweenOrderByTradeDateAsc(
            String market,
            String breadthType,
            LocalDate from,
            LocalDate to
    );
}
