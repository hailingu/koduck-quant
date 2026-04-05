package com.koduck.strategy.api;

import com.koduck.strategy.dto.BacktestRequestDto;
import com.koduck.strategy.dto.BacktestResultDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * 回测命令服务接口。
 *
 * <p>提供回测的执行和删除操作。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
public interface BacktestCommandService {

    /**
     * 执行回测。
     *
     * <p>异步执行回测，返回回测任务ID。实际结果需要通过
     * {@link BacktestQueryService#getBacktestResult} 查询。</p>
     *
     * @param userId 用户ID
     * @param request 回测请求
     * @return 回测任务ID
     */
    Long executeBacktest(@NotNull @Positive Long userId, @Valid BacktestRequestDto request);

    /**
     * 删除回测记录。
     *
     * @param backtestId 回测ID
     */
    void deleteBacktest(@NotNull @Positive Long backtestId);

    /**
     * 取消正在执行的回测。
     *
     * @param backtestId 回测ID
     * @return 是否成功取消
     */
    boolean cancelBacktest(@NotNull @Positive Long backtestId);
}
