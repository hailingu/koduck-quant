package com.koduck.repository.strategy;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.strategy.StrategyParameter;

/**
 * 策略参数操作仓库，提供策略参数数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface StrategyParameterRepository extends JpaRepository<StrategyParameter, Long> {

    /**
     * 查询策略的所有参数，按排序顺序排列。
     *
     * @param strategyId 策略 ID
     * @return 策略参数列表
     */
    List<StrategyParameter> findByStrategyIdOrderBySortOrderAsc(Long strategyId);

    /**
     * 根据策略和参数名称查询参数。
     *
     * @param strategyId 策略 ID
     * @param paramName 参数名称
     * @return 策略参数
     */
    StrategyParameter findByStrategyIdAndParamName(Long strategyId, String paramName);

    /**
     * 删除策略的所有参数。
     *
     * @param strategyId 策略 ID
     */
    @Modifying
    @Query("DELETE FROM StrategyParameter sp WHERE sp.strategyId = :strategyId")
    void deleteByStrategyId(@Param("strategyId") Long strategyId);

    /**
     * 检查参数是否存在。
     *
     * @param strategyId 策略 ID
     * @param paramName 参数名称
     * @return 如果存在返回 true
     */
    boolean existsByStrategyIdAndParamName(Long strategyId, String paramName);
}
