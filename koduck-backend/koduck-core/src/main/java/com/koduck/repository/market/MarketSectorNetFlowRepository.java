package com.koduck.repository.market;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.market.MarketSectorNetFlow;

/**
 * 市场板块资金流向操作仓库，提供市场板块资金流向数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface MarketSectorNetFlowRepository extends JpaRepository<MarketSectorNetFlow, Long> {

    /**
     * 根据市场和指标查询最新记录，按交易日排序。
     *
     * @param market 市场代码
     * @param indicator 指标类型
     * @return 市场板块资金流向
     */
    Optional<MarketSectorNetFlow> findFirstByMarketAndIndicatorOrderByTradeDateDesc(
            String market, String indicator);

    /**
     * 根据市场、指标和交易日查询记录。
     *
     * @param market 市场代码
     * @param indicator 指标类型
     * @param tradeDate 交易日
     * @return 市场板块资金流向列表
     */
    List<MarketSectorNetFlow> findByMarketAndIndicatorAndTradeDate(
            String market, String indicator, LocalDate tradeDate);
}
