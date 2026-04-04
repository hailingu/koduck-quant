package com.koduck.repository.backtest;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.backtest.BacktestTrade;

/**
 * 回测交易操作仓库，提供回测交易数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface BacktestTradeRepository extends JpaRepository<BacktestTrade, Long> {

    /**
     * 查询回测结果的所有交易。
     *
     * @param backtestResultId 回测结果 ID
     * @return 回测交易列表
     */
    List<BacktestTrade> findByBacktestResultIdOrderByTradeTimeAsc(Long backtestResultId);

    /**
     * 删除回测结果的所有交易。
     *
     * @param backtestResultId 回测结果 ID
     */
    void deleteByBacktestResultId(Long backtestResultId);
}
