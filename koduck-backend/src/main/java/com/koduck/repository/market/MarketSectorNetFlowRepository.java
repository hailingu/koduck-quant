package com.koduck.repository.market;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.market.MarketSectorNetFlow;

/**
 * Repository for Market Sector Net Flow operations.
 *
 * @author Koduck Team
 */
@Repository
public interface MarketSectorNetFlowRepository extends JpaRepository<MarketSectorNetFlow, Long> {

    Optional<MarketSectorNetFlow> findFirstByMarketAndIndicatorOrderByTradeDateDesc(
            String market, String indicator);

    List<MarketSectorNetFlow> findByMarketAndIndicatorAndTradeDate(
            String market, String indicator, LocalDate tradeDate);
}
