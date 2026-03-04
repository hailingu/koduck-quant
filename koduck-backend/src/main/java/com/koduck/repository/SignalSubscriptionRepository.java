package com.koduck.repository;

import com.koduck.entity.SignalSubscription;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 信号订阅 Repository
 */
@Repository
public interface SignalSubscriptionRepository extends JpaRepository<SignalSubscription, Long> {

    /**
     * 根据信号 ID 和用户 ID 查询订阅
     */
    Optional<SignalSubscription> findBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 检查用户是否已订阅信号
     */
    boolean existsBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 根据用户 ID 查询订阅列表
     */
    Page<SignalSubscription> findByUserId(Long userId, Pageable pageable);

    /**
     * 根据用户 ID 查询订阅列表（不分页）
     */
    List<SignalSubscription> findByUserId(Long userId);

    /**
     * 根据信号 ID 查询所有订阅
     */
    List<SignalSubscription> findBySignalId(Long signalId);

    /**
     * 统计信号的订阅数量
     */
    long countBySignalId(Long signalId);

    /**
     * 统计用户的订阅数量
     */
    long countByUserId(Long userId);

    /**
     * 删除订阅
     */
    void deleteBySignalIdAndUserId(Long signalId, Long userId);

    /**
     * 获取用户订阅的信号 ID 列表
     */
    @Query("SELECT s.signalId FROM SignalSubscription s WHERE s.userId = :userId")
    List<Long> findSignalIdsByUserId(@Param("userId") Long userId);
}
