package com.koduck.repository;

import com.koduck.entity.StrategyVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for strategy version operations.
 */
@Repository
public interface StrategyVersionRepository extends JpaRepository<StrategyVersion, Long> {
    
    /**
     * Find all versions for a strategy.
     */
    List<StrategyVersion> findByStrategyIdOrderByVersionNumberDesc(Long strategyId);
    
    /**
     * Find a specific version by strategy and version number.
     */
    Optional<StrategyVersion> findByStrategyIdAndVersionNumber(Long strategyId, Integer versionNumber);
    
    /**
     * Find the latest version for a strategy.
     */
    Optional<StrategyVersion> findFirstByStrategyIdOrderByVersionNumberDesc(Long strategyId);
    
    /**
     * Find the active version for a strategy.
     */
    Optional<StrategyVersion> findByStrategyIdAndIsActiveTrue(Long strategyId);
    
    /**
     * Deactivate all versions for a strategy.
     */
    @Modifying
    @Query("UPDATE StrategyVersion sv SET sv.isActive = false WHERE sv.strategyId = :strategyId")
    void deactivateAllVersions(@Param("strategyId") Long strategyId);
    
    /**
     * Activate a specific version.
     */
    @Modifying
    @Query("UPDATE StrategyVersion sv SET sv.isActive = true WHERE sv.id = :id")
    void activateVersion(@Param("id") Long id);
    
    /**
     * Count versions for a strategy.
     */
    long countByStrategyId(Long strategyId);
}
