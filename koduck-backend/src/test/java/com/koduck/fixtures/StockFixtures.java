package com.koduck.fixtures;

import com.koduck.entity.StockBasic;
import com.koduck.entity.StockRealtime;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * 股票相关测试数据工厂。
 *
 * <p>提供标准化的 Mock 数据创建方法，确保测试数据的一致性和可维护性。
 *
 * @author GitHub Copilot
 * @since 1.0.0
 */
public final class StockFixtures {

    private StockFixtures() {
        // 工具类，禁止实例化
        throw new AssertionError("Utility class should not be instantiated");
    }

    // ==================== StockRealtime Fixtures ====================

    /**
     * 创建标准股票实时价格 Mock 数据。
     *
     * @param symbol 股票代码
     * @return 股票实时价格实体
     */
    public static StockRealtime createRealtimePrice(String symbol) {
        return StockRealtime.builder()
                .symbol(symbol)
                .name("测试股票")
                .price(new BigDecimal("10.50"))
                .changePercent(new BigDecimal("0.025"))
                .changeAmount(new BigDecimal("0.25"))
                .openPrice(new BigDecimal("10.25"))
                .high(new BigDecimal("10.80"))
                .low(new BigDecimal("10.20"))
                .prevClose(new BigDecimal("10.25"))
                .volume(1000000L)
                .amount(new BigDecimal("10500000"))
                .updatedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建带名称的股票实时价格 Mock 数据。
     *
     * @param symbol 股票代码
     * @param name 股票名称
     * @return 股票实时价格实体
     */
    public static StockRealtime createRealtimePrice(String symbol, String name) {
        return StockRealtime.builder()
                .symbol(symbol)
                .name(name)
                .price(new BigDecimal("10.50"))
                .changePercent(new BigDecimal("0.025"))
                .changeAmount(new BigDecimal("0.25"))
                .openPrice(new BigDecimal("10.25"))
                .high(new BigDecimal("10.80"))
                .low(new BigDecimal("10.20"))
                .prevClose(new BigDecimal("10.25"))
                .volume(1000000L)
                .amount(new BigDecimal("10500000"))
                .updatedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建多只股票实时价格 Mock 数据列表。
     *
     * @param count 数量
     * @return 股票实时价格列表
     */
    public static List<StockRealtime> createRealtimePriceList(int count) {
        return IntStream.range(0, count)
                .mapToObj(i -> createRealtimePrice(String.format("%06d.SZ", i + 1)))
                .collect(Collectors.toList());
    }

    /**
     * 创建涨停板股票 Mock 数据（涨幅 +10%）。
     *
     * @param symbol 股票代码
     * @return 涨停股票实时价格实体
     */
    public static StockRealtime createLimitUpPrice(String symbol) {
        return StockRealtime.builder()
                .symbol(symbol)
                .name("涨停股票")
                .price(new BigDecimal("11.00"))
                .changePercent(new BigDecimal("0.100"))
                .changeAmount(new BigDecimal("1.00"))
                .openPrice(new BigDecimal("10.20"))
                .high(new BigDecimal("11.00"))
                .low(new BigDecimal("10.10"))
                .prevClose(new BigDecimal("10.00"))
                .volume(5000000L)
                .amount(new BigDecimal("55000000"))
                .updatedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建跌停板股票 Mock 数据（跌幅 -10%）。
     *
     * @param symbol 股票代码
     * @return 跌停股票实时价格实体
     */
    public static StockRealtime createLimitDownPrice(String symbol) {
        return StockRealtime.builder()
                .symbol(symbol)
                .name("跌停股票")
                .price(new BigDecimal("9.00"))
                .changePercent(new BigDecimal("-0.100"))
                .changeAmount(new BigDecimal("-1.00"))
                .openPrice(new BigDecimal("9.80"))
                .high(new BigDecimal("9.90"))
                .low(new BigDecimal("9.00"))
                .prevClose(new BigDecimal("10.00"))
                .volume(8000000L)
                .amount(new BigDecimal("72000000"))
                .updatedAt(LocalDateTime.now())
                .build();
    }

    /**
     * 创建平盘股票 Mock 数据（涨跌幅 0%）。
     *
     * @param symbol 股票代码
     * @return 平盘股票实时价格实体
     */
    public static StockRealtime createFlatPrice(String symbol) {
        return StockRealtime.builder()
                .symbol(symbol)
                .name("平盘股票")
                .price(new BigDecimal("10.00"))
                .changePercent(BigDecimal.ZERO)
                .changeAmount(BigDecimal.ZERO)
                .openPrice(new BigDecimal("10.00"))
                .high(new BigDecimal("10.10"))
                .low(new BigDecimal("9.90"))
                .prevClose(new BigDecimal("10.00"))
                .volume(1000000L)
                .amount(new BigDecimal("10000000"))
                .updatedAt(LocalDateTime.now())
                .build();
    }

    // ==================== StockBasic Fixtures ====================

    /**
     * 创建基础股票信息 Mock 数据。
     *
     * @param symbol 股票代码
     * @return 股票基础信息实体
     */
    public static StockBasic createStockBasic(String symbol) {
        return StockBasic.builder()
                .symbol(symbol)
                .name("测试股票")
                .market("SZSE")
                .industry("其他")
                .city("深圳")
                .listDate(LocalDate.of(2020, 1, 1))
                .status("Active")
                .build();
    }

    /**
     * 创建基础股票信息 Mock 数据（带名称和行业）。
     *
     * @param symbol 股票代码
     * @param name 股票名称
     * @param industry 所属行业
     * @return 股票基础信息实体
     */
    public static StockBasic createStockBasic(String symbol, String name, String industry) {
        return StockBasic.builder()
                .symbol(symbol)
                .name(name)
                .market(symbol.endsWith(".SZ") ? "SZSE" : "SSE")
                .industry(industry)
                .city("深圳")
                .listDate(LocalDate.of(2020, 1, 1))
                .status("Active")
                .build();
    }

    /**
     * 创建常见股票 Mock 数据列表（深市主板）。
     *
     * @return 常见股票列表
     */
    public static List<StockBasic> createCommonStocks() {
        return List.of(
                createStockBasic("000001.SZ", "平安银行", "银行"),
                createStockBasic("000002.SZ", "万科A", "房地产"),
                createStockBasic("000063.SZ", "中兴通讯", "通信设备"),
                createStockBasic("000100.SZ", "TCL科技", "电子"),
                createStockBasic("000333.SZ", "美的集团", "家电")
        );
    }

    // ==================== 辅助方法 ====================

    /**
     * 随机生成价格。
     *
     * @param min 最小值
     * @param max 最大值
     * @return 随机价格
     */
    public static BigDecimal randomPrice(double min, double max) {
        double price = min + Math.random() * (max - min);
        return BigDecimal.valueOf(price).setScale(2, BigDecimal.ROUND_HALF_UP);
    }

    /**
     * 随机生成涨跌幅（-10% 到 +10%）。
     *
     * @return 随机涨跌幅
     */
    public static BigDecimal randomChangePercent() {
        double change = (Math.random() - 0.5) * 0.2; // -0.1 到 0.1
        return BigDecimal.valueOf(change).setScale(4, BigDecimal.ROUND_HALF_UP);
    }
}
