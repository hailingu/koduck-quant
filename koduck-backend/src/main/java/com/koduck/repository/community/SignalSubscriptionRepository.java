package com.koduck.repository.community;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.community.SignalSubscription;

/**
 * 信号订阅仓库，提供信号订阅数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface SignalSubscriptionRepository extends JpaRepository<SignalSubscription, Long> {

    /**
     * 根据信号 ID 和用户 ID 检查订阅是否存在。
     *
     * @param signalId 信号 ID
     * @param userId 用户 ID
     * @return 如果存在返回 true，否则返回 false
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 根据用户 ID 查询订阅列表。
     *
     * @param userId 用户 ID
     * @return 订阅列表
     */
    List<SignalSubscription> findByUserId(Long userId);

    /**
     * 根据信号 ID 和用户 ID 删除订阅。
     *
     * @param signalId 信号 ID
     * @param userId 用户 ID
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 根据用户 ID 查询信号 ID 列表。
     *
     * @param userId 用户 ID
     * @return 信号 ID 列表
     */
    @Query("SELECT s.signalId FROM SignalSubscription s WHERE s.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
