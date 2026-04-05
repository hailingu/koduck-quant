package com.koduck.repository.market;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.market.entity.MarketDailyBreadth;

/**
 * 市场每日涨跌宽度数据仓库，提供市场涨跌宽度数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface MarketDailyBreadthRepository
        extends JpaRepository<MarketDailyBreadth, Long> {

    /**
     * 根据市场和宽度类型查询最新记录，按交易日排序。
     *
     * @param market 市场代码
     * @param breadthType 宽度类型
     * @return 市场每日涨跌宽度
     */
    Optional<MarketDailyBreadth> findFirstByMarketAndBreadthTypeOrderByTradeDateDesc(
            String market,
            String breadthType);

    /**
     * 根据市场、宽度类型和交易日查询记录。
     *
     * @param market 市场代码
     * @param breadthType 宽度类型
     * @param tradeDate 交易日
     * @return 市场每日涨跌宽度
     */
    Optional<MarketDailyBreadth> findByMarketAndBreadthTypeAndTradeDate(
            String market,
            String breadthType,
            LocalDate tradeDate);

    /**
     * 根据市场、宽度类型和日期范围查询记录。
     *
     * @param market 市场代码
     * @param breadthType 宽度类型
     * @param from 开始日期
     * @param to 结束日期
     * @return 市场每日涨跌宽度记录列表
     */
    List<MarketDailyBreadth> findByMarketAndBreadthTypeAndTradeDateBetweenOrderByTradeDateAsc(
            String market,
            String breadthType,
            LocalDate from,
            LocalDate to
    );
}
