package com.koduck.repository.market;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.koduck.market.entity.DataSourceStatus;

/**
 * 数据源状态仓库，提供数据源状态数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface DataSourceStatusRepository extends JpaRepository<DataSourceStatus, Long> {

    /**
     * 根据数据源名称查询数据源状态。
     *
     * @param sourceName 数据源名称
     * @return 数据源状态
     */
    Optional<DataSourceStatus> findBySourceName(String sourceName);

    /**
     * 根据状态查询所有数据源。
     *
     * @param status 状态
     * @return 数据源状态列表
     */
    List<DataSourceStatus> findByStatus(String status);

    /**
     * 查询不健康的数据源（非 HEALTHY 状态）。
     *
     * @return 不健康数据源列表
     */
    @Query("SELECT d FROM DataSourceStatus d WHERE d.status != 'HEALTHY'")
    List<DataSourceStatus> findUnhealthySources();

    /**
     * 查询失败次数超过阈值的数据源。
     *
     * @param threshold 失败阈值
     * @return 失败次数高的数据源列表
     */
    @Query("SELECT d FROM DataSourceStatus d WHERE d.consecutiveFailures >= :threshold")
    List<DataSourceStatus> findSourcesWithHighFailures(int threshold);
}
