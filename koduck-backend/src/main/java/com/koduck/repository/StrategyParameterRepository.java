package com.koduck.repository;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.StrategyParameter;

/**
 * Repository for strategy parameter operations.
 */
@Repository
public interface StrategyParameterRepository extends JpaRepository<StrategyParameter, Long> {
    
    /**
     * Find all parameters for a strategy, ordered by sort order.
     */
    List<StrategyParameter> findByStrategyIdOrderBySortOrderAsc(Long strategyId);
    
    /**
     * Find a parameter by strategy and name.
     */
    StrategyParameter findByStrategyIdAndParamName(Long strategyId, String paramName);
    
    /**
     * Delete all parameters for a strategy.
     */
    @Modifying
    @Query("DELETE FROM StrategyParameter sp WHERE sp.strategyId = :strategyId")
    void deleteByStrategyId(@Param("strategyId") Long strategyId);
    
    /**
     * Check if a parameter exists.
     */
    boolean existsByStrategyIdAndParamName(Long strategyId, String paramName);
}
