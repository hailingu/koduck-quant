package com.koduck.repository.market;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.market.entity.StockTickHistory;

/**
 * 股票分笔成交历史仓库，提供分笔成交数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface StockTickHistoryRepository extends JpaRepository<StockTickHistory, Long> {

    /**
     * 根据股票代码分页查询分笔成交记录，按成交时间和 ID 降序排列。
     *
     * @param symbol 股票代码
     * @param pageable 分页对象
     * @return 分笔成交记录列表
     */
    List<StockTickHistory> findBySymbolOrderByTickTimeDescIdDesc(String symbol, Pageable pageable);

    /**
     * 根据股票代码和 ID 查询大于指定 ID 的分笔成交记录，按 ID 升序排列。
     *
     * @param symbol 股票代码
     * @param lastId 最后 ID
     * @return 分笔成交记录列表
     */
    List<StockTickHistory> findBySymbolAndIdGreaterThanOrderByIdAsc(String symbol, Long lastId);
}
