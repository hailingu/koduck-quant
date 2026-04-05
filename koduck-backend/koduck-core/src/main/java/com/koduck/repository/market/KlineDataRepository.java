package com.koduck.repository.market;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.market.entity.KlineData;

/**
 * K 线数据操作仓库，提供 K 线数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface KlineDataRepository extends JpaRepository<KlineData, Long> {

    /**
     * 根据市场、股票代码、时间框架和时间范围查询 K 线数据。
     *
     * @param market 市场
     * @param symbol 股票代码
     * @param timeframe 时间框架
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return K 线数据列表
     */
    List<KlineData> findByMarketAndSymbolAndTimeframeAndKlineTimeBetweenOrderByKlineTimeDesc(
            String market, String symbol, String timeframe,
            LocalDateTime startTime, LocalDateTime endTime);

    /**
     * 分页查询 K 线数据。
     *
     * @param market 市场
     * @param symbol 股票代码
     * @param timeframe 时间框架
     * @param pageable 分页对象
     * @return K 线数据列表
     */
    List<KlineData> findByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
            String market, String symbol, String timeframe, Pageable pageable);

    /**
     * 查询指定时间之前的 K 线数据。
     *
     * @param market 市场
     * @param symbol 股票代码
     * @param timeframe 时间框架
     * @param beforeTime 截止时间
     * @param pageable 分页对象
     * @return K 线数据列表
     */
    @Query("SELECT k FROM KlineData k WHERE k.market = :market AND k.symbol = :symbol " +
           "AND k.timeframe = :timeframe AND k.klineTime < :beforeTime " +
           "ORDER BY k.klineTime DESC")
    List<KlineData> findBeforeTime(@Param("market") String market,
                                   @Param("symbol") String symbol,
                                   @Param("timeframe") String timeframe,
                                   @Param("beforeTime") LocalDateTime beforeTime,
                                   Pageable pageable);

    /**
     * 查询指定股票的最新 K 线数据。
     *
     * @param market 市场
     * @param symbol 股票代码
     * @param timeframe 时间框架
     * @return K 线数据
     */
    Optional<KlineData> findFirstByMarketAndSymbolAndTimeframeOrderByKlineTimeDesc(
            String market, String symbol, String timeframe);

    /**
     * 检查指定时间的数据是否存在。
     *
     * @param market 市场
     * @param symbol 股票代码
     * @param timeframe 时间框架
     * @param klineTime K 线时间
     * @return 如果存在返回 true，否则返回 false
     */
    boolean existsByMarketAndSymbolAndTimeframeAndKlineTime(
            String market, String symbol, String timeframe, LocalDateTime klineTime);

    /**
     * 统计指定股票的数据点数量。
     *
     * @param market 市场
     * @param symbol 股票代码
     * @param timeframe 时间框架
     * @return 数据点数量
     */
    long countByMarketAndSymbolAndTimeframe(String market, String symbol, String timeframe);

    /**
     * 删除旧数据（用于数据保留策略）。
     *
     * @param cutoffTime 截止时间
     */
    void deleteByKlineTimeBefore(LocalDateTime cutoffTime);
}
