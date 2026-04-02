package com.koduck.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.StrategyVersion;

/**
 * Repository for strategy version operations.
 *
 * @author Koduck Team
 */
@Repository
public interface StrategyVersionRepository extends JpaRepository<StrategyVersion, Long> {

    /**
     * Find all versions for a strategy.
     *
     * @param strategyId the strategy ID
     * @return list of strategy versions
     */
    List<StrategyVersion> findByStrategyIdOrderByVersionNumberDesc(Long strategyId);

    /**
     * Find a specific version by strategy and version number.
     *
     * @param strategyId the strategy ID
     * @param versionNumber the version number
     * @return the strategy version
     */
    Optional<StrategyVersion> findByStrategyIdAndVersionNumber(Long strategyId, Integer versionNumber);

    /**
     * Find the latest version for a strategy.
     *
     * @param strategyId the strategy ID
     * @return the latest strategy version
     */
    Optional<StrategyVersion> findFirstByStrategyIdOrderByVersionNumberDesc(Long strategyId);

    /**
     * Find the active version for a strategy.
     *
     * @param strategyId the strategy ID
     * @return the active strategy version
     */
    Optional<StrategyVersion> findByStrategyIdAndIsActiveTrue(Long strategyId);

    /**
     * Deactivate all versions for a strategy.
     *
     * @param strategyId the strategy ID
     */
    @Modifying
    @Query("UPDATE StrategyVersion sv SET sv.isActive = false WHERE sv.strategyId = :strategyId")
    void deactivateAllVersions(@Param("strategyId") Long strategyId);

    /**
     * Activate a specific version.
     *
     * @param id the version ID
     */
    @Modifying
    @Query("UPDATE StrategyVersion sv SET sv.isActive = true WHERE sv.id = :id")
    void activateVersion(@Param("id") Long id);

    /**
     * Count versions for a strategy.
     *
     * @param strategyId the strategy ID
     * @return the count
     */
    long countByStrategyId(Long strategyId);
}
