package com.koduck.repository.market;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.koduck.entity.market.StockRealtime;

/**
 * 股票实时价格数据仓库，提供行情数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface StockRealtimeRepository extends JpaRepository<StockRealtime, String> {

    /**
     * 根据股票代码查询股票实时数据。
     *
     * @param symbol 股票代码
     * @return 股票实时数据
     */
    Optional<StockRealtime> findBySymbol(String symbol);

    /**
     * 根据股票代码查询最新行情数据。
     * 适用于遗留数据可能包含重复股票代码行的场景。
     *
     * @param symbol 股票代码
     * @return 最新股票实时数据
     */
    Optional<StockRealtime> findFirstBySymbolOrderByUpdatedAtDesc(String symbol);

    /**
     * 根据多个股票代码查询股票实时数据。
     *
     * @param symbols 股票代码列表
     * @return 股票实时数据列表
     */
    List<StockRealtime> findBySymbolIn(List<String> symbols);

    /**
     * 根据多个股票代码和类型查询股票实时数据。
     * 用于区分具有相同代码的股票和指数。
     *
     * @param symbols 股票代码列表
     * @param type 股票类型
     * @return 股票实时数据列表
     */
    List<StockRealtime> findBySymbolInAndType(List<String> symbols, String type);

    /**
     * 按成交量降序查询股票。
     *
     * @param pageable 分页信息
     * @return 股票实时数据列表
     */
    @Query("SELECT s FROM StockRealtime s WHERE s.volume IS NOT NULL ORDER BY s.volume DESC")
    List<StockRealtime> findTopByVolume(Pageable pageable);

    /**
     * 查询更新延迟的股票（延迟超过阈值秒数）。
     * 使用原生查询进行 PostgreSQL 时间间隔计算。
     *
     * @param threshold 阈值秒数
     * @return 更新延迟的股票实时数据列表
     */
    @Query(value = "SELECT * FROM stock_realtime WHERE updated_at < NOW() - MAKE_INTERVAL(secs => :threshold) "
            + "ORDER BY updated_at ASC", nativeQuery = true)
    List<StockRealtime> findDelayedStocks(int threshold);

    /**
     * 统计更新延迟的股票数量。
     *
     * @param threshold 阈值秒数
     * @return 更新延迟的股票数量
     */
    @Query(value = "SELECT COUNT(*) FROM stock_realtime WHERE updated_at < MAKE_INTERVAL(secs => :threshold)",
            nativeQuery = true)
    long countDelayedStocks(int threshold);
}
