package com.koduck.service;

import java.util.List;

import com.koduck.dto.backtest.BacktestResultDto;
import com.koduck.dto.backtest.BacktestTradeDto;
import com.koduck.dto.backtest.RunBacktestRequest;

/**
 * 回测操作服务接口。
 *
 * @author Koduck Team
 */
public interface BacktestService {

    /**
     * 获取用户的所有回测结果。
     *
     * @param userId 用户ID
     * @return 回测结果列表
     */
    List<BacktestResultDto> getBacktestResults(Long userId);

    /**
     * 根据ID获取回测结果。
     *
     * @param userId 用户ID
     * @param id     回测结果ID
     * @return 回测结果
     */
    BacktestResultDto getBacktestResult(Long userId, Long id);

    /**
     * 运行回测。
     *
     * @param userId  用户ID
     * @param request 回测请求
     * @return 回测结果
     */
    BacktestResultDto runBacktest(Long userId, RunBacktestRequest request);

    /**
     * 获取回测结果的交易记录。
     *
     * @param userId     用户ID
     * @param backtestId 回测ID
     * @return 回测交易列表
     */
    List<BacktestTradeDto> getBacktestTrades(Long userId, Long backtestId);

    /**
     * 删除回测结果。
     *
     * @param userId 用户ID
     * @param id     回测结果ID
     */
    void deleteBacktestResult(Long userId, Long id);
}
