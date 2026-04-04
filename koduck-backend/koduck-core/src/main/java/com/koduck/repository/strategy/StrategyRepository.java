package com.koduck.repository.strategy;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.strategy.Strategy;

/**
 * 策略操作仓库，提供策略数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface StrategyRepository extends JpaRepository<Strategy, Long> {

    /**
     * 查询用户的所有策略。
     *
     * @param userId 用户 ID
     * @return 策略列表
     */
    List<Strategy> findByUserId(Long userId);

    /**
     * 根据用户和状态查询策略。
     *
     * @param userId 用户 ID
     * @param status 策略状态
     * @return 策略列表
     */
    List<Strategy> findByUserIdAndStatus(Long userId, Strategy.StrategyStatus status);

    /**
     * 根据 ID 和用户查询策略。
     *
     * @param id 策略 ID
     * @param userId 用户 ID
     * @return 策略
     */
    Optional<Strategy> findByIdAndUserId(Long id, Long userId);

    /**
     * 根据 ID 和用户检查策略是否存在。
     *
     * @param id 策略 ID
     * @param userId 用户 ID
     * @return 如果存在返回 true
     */
    boolean existsByIdAndUserId(Long id, Long userId);

    /**
     * 根据 ID 和用户删除策略。
     *
     * @param id 策略 ID
     * @param userId 用户 ID
     */
    @Modifying
    @Query("DELETE FROM Strategy s WHERE s.id = :id AND s.userId = :userId")
    void deleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    /**
     * 统计用户的策略数量。
     *
     * @param userId 用户 ID
     * @return 数量
     */
    long countByUserId(Long userId);

    /**
     * 更新策略状态。
     *
     * @param id 策略 ID
     * @param userId 用户 ID
     * @param status 策略状态
     */
    @Modifying
    @Query("UPDATE Strategy s SET s.status = :status "
            + "WHERE s.id = :id AND s.userId = :userId")
    void updateStatus(@Param("id") Long id, @Param("userId") Long userId,
                      @Param("status") Strategy.StrategyStatus status);

    /**
     * 增加当前版本号。
     *
     * @param id 策略 ID
     */
    @Modifying
    @Query("UPDATE Strategy s SET s.currentVersion = s.currentVersion + 1 WHERE s.id = :id")
    void incrementVersion(@Param("id") Long id);
}
