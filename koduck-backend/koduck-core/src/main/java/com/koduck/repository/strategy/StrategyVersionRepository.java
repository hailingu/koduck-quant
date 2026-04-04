package com.koduck.repository.strategy;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.strategy.StrategyVersion;

/**
 * 策略版本操作仓库，提供策略版本数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface StrategyVersionRepository extends JpaRepository<StrategyVersion, Long> {

    /**
     * 查询策略的所有版本，按版本号降序排列。
     *
     * @param strategyId 策略 ID
     * @return 策略版本列表
     */
    List<StrategyVersion> findByStrategyIdOrderByVersionNumberDesc(Long strategyId);

    /**
     * 根据策略和版本号查询特定版本。
     *
     * @param strategyId 策略 ID
     * @param versionNumber 版本号
     * @return 策略版本
     */
    Optional<StrategyVersion> findByStrategyIdAndVersionNumber(Long strategyId, Integer versionNumber);

    /**
     * 查询策略的最新版本。
     *
     * @param strategyId 策略 ID
     * @return 最新策略版本
     */
    Optional<StrategyVersion> findFirstByStrategyIdOrderByVersionNumberDesc(Long strategyId);

    /**
     * 查询策略的活跃版本。
     *
     * @param strategyId 策略 ID
     * @return 活跃策略版本
     */
    Optional<StrategyVersion> findByStrategyIdAndIsActiveTrue(Long strategyId);

    /**
     * 停用策略的所有版本。
     *
     * @param strategyId 策略 ID
     */
    @Modifying
    @Query("UPDATE StrategyVersion sv SET sv.isActive = false WHERE sv.strategyId = :strategyId")
    void deactivateAllVersions(@Param("strategyId") Long strategyId);

    /**
     * 激活指定版本。
     *
     * @param id 版本 ID
     */
    @Modifying
    @Query("UPDATE StrategyVersion sv SET sv.isActive = true WHERE sv.id = :id")
    void activateVersion(@Param("id") Long id);

    /**
     * 统计策略的版本数量。
     *
     * @param strategyId 策略 ID
     * @return 数量
     */
    long countByStrategyId(Long strategyId);
}
