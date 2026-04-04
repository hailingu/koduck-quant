package com.koduck.repository.market;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.MarketDailyBreadth;

/**
 * Repository for market daily breadth data.
 *
 * @author Koduck Team
 */
@Repository
public interface MarketDailyBreadthRepository
        extends JpaRepository<MarketDailyBreadth, Long> {

    /**
     * Find the first record by market and breadth type, ordered by trade date.
     *
     * @param market      the market code
     * @param breadthType the breadth type
     * @return optional of market daily breadth
     */
    Optional<MarketDailyBreadth> findFirstByMarketAndBreadthTypeOrderByTradeDateDesc(
            String market,
            String breadthType);

    /**
     * Find record by market, breadth type and trade date.
     *
     * @param market      the market code
     * @param breadthType the breadth type
     * @param tradeDate   the trade date
     * @return optional of market daily breadth
     */
    Optional<MarketDailyBreadth> findByMarketAndBreadthTypeAndTradeDate(
            String market,
            String breadthType,
            LocalDate tradeDate);

    /**
     * Find records by market, breadth type and date range.
     *
     * @param market      the market code
     * @param breadthType the breadth type
     * @param from        the start date
     * @param to          the end date
     * @return list of market daily breadth records
     */
    List<MarketDailyBreadth> findByMarketAndBreadthTypeAndTradeDateBetweenOrderByTradeDateAsc(
            String market,
            String breadthType,
            LocalDate from,
            LocalDate to
    );
}
