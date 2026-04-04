package com.koduck.repository.market;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.koduck.entity.market.DataSourceStatus;

/**
 * Repository for data source status.
 *
 * @author Koduck Team
 */
@Repository
public interface DataSourceStatusRepository extends JpaRepository<DataSourceStatus, Long> {

    /**
     * Find data source by name.
     *
     * @param sourceName the source name
     * @return optional data source status
     */
    Optional<DataSourceStatus> findBySourceName(String sourceName);

    /**
     * Find all data sources with a specific status.
     *
     * @param status the status
     * @return list of data source status
     */
    List<DataSourceStatus> findByStatus(String status);

    /**
     * Find unhealthy data sources (not HEALTHY).
     *
     * @return list of unhealthy data sources
     */
    @Query("SELECT d FROM DataSourceStatus d WHERE d.status != 'HEALTHY'")
    List<DataSourceStatus> findUnhealthySources();

    /**
     * Find data sources with high failure count.
     *
     * @param threshold the failure threshold
     * @return list of data sources with high failures
     */
    @Query("SELECT d FROM DataSourceStatus d WHERE d.consecutiveFailures >= :threshold")
    List<DataSourceStatus> findSourcesWithHighFailures(int threshold);
}
