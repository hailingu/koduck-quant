package com.koduck.repository.market;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.market.MarketDailyNetFlow;

/**
 * 市场每日资金流向数据仓库，提供市场资金流向数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface MarketDailyNetFlowRepository extends JpaRepository<MarketDailyNetFlow, Long> {

    /**
     * 根据市场和资金流向类型查询最新记录，按交易日排序。
     *
     * @param market 市场代码
     * @param flowType 资金流向类型
     * @return 市场每日资金流向
     */
    Optional<MarketDailyNetFlow> findFirstByMarketAndFlowTypeOrderByTradeDateDesc(String market, String flowType);

    /**
     * 根据市场、资金流向类型和交易日查询记录。
     *
     * @param market 市场代码
     * @param flowType 资金流向类型
     * @param tradeDate 交易日
     * @return 市场每日资金流向
     */
    Optional<MarketDailyNetFlow> findByMarketAndFlowTypeAndTradeDate(
        String market,
        String flowType,
        LocalDate tradeDate
    );

    /**
     * 根据市场、资金流向类型和日期范围查询记录。
     *
     * @param market 市场代码
     * @param flowType 资金流向类型
     * @param from 开始日期
     * @param to 结束日期
     * @return 市场每日资金流向记录列表
     */
    List<MarketDailyNetFlow> findByMarketAndFlowTypeAndTradeDateBetweenOrderByTradeDateAsc(
        String market,
        String flowType,
        LocalDate from,
        LocalDate to
    );
}
