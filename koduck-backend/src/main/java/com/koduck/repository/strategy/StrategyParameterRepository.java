package com.koduck.repository.strategy;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.StrategyParameter;

/**
 * Repository for strategy parameter operations.
 *
 * @author Koduck Team
 */
@Repository
public interface StrategyParameterRepository extends JpaRepository<StrategyParameter, Long> {

    /**
     * Find all parameters for a strategy, ordered by sort order.
     *
     * @param strategyId the strategy ID
     * @return list of strategy parameters
     */
    List<StrategyParameter> findByStrategyIdOrderBySortOrderAsc(Long strategyId);

    /**
     * Find a parameter by strategy and name.
     *
     * @param strategyId the strategy ID
     * @param paramName the parameter name
     * @return the strategy parameter
     */
    StrategyParameter findByStrategyIdAndParamName(Long strategyId, String paramName);

    /**
     * Delete all parameters for a strategy.
     *
     * @param strategyId the strategy ID
     */
    @Modifying
    @Query("DELETE FROM StrategyParameter sp WHERE sp.strategyId = :strategyId")
    void deleteByStrategyId(@Param("strategyId") Long strategyId);

    /**
     * Check if a parameter exists.
     *
     * @param strategyId the strategy ID
     * @param paramName the parameter name
     * @return true if parameter exists
     */
    boolean existsByStrategyIdAndParamName(Long strategyId, String paramName);
}
