package com.koduck.market.api;

import jakarta.validation.constraints.NotBlank;

/**
 * 市场数据命令服务接口，提供数据刷新、缓存管理等写操作。
 *
 * <p>此接口包含所有修改状态的操作，与 {@link MarketQueryService} 分离，
 * 遵循 CQRS（命令查询职责分离）原则。</p>
 *
 * @author Koduck Team
 * @see MarketQueryService
 */
public interface MarketCommandService {

    /**
     * 刷新指定股票的实时行情缓存。
     *
     * @param symbol 股票代码
     * @return true 如果刷新成功
     * @throws IllegalArgumentException 当 symbol 为空或格式非法时
     */
    boolean refreshPriceCache(@NotBlank String symbol);

    /**
     * 批量刷新多只股票的实时行情缓存。
     *
     * @param symbols 股票代码列表，逗号分隔
     * @return 成功刷新的股票数量
     * @throws IllegalArgumentException 当 symbols 为空时
     */
    int refreshBatchPriceCache(@NotBlank String symbols);

    /**
     * 清除指定市场的所有缓存数据。
     *
     * @param market 市场代码（例如 "AShare", "US", "Crypto"）
     * @return 被清除的缓存键数量
     */
    int clearMarketCache(@NotBlank String market);

    /**
     * 触发市场数据全量同步。
     *
     * <p>此操作通常由定时任务调用，用于同步外部数据源的最新数据。</p>
     *
     * @param market 市场代码
     * @return 同步的数据条数
     */
    int syncMarketData(@NotBlank String market);
}
