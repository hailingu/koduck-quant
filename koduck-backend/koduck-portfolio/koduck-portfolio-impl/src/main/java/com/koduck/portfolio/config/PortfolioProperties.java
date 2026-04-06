package com.koduck.portfolio.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Portfolio 模块配置属性。
 *
 * <p>配置前缀: {@code koduck.portfolio}</p>
 *
 * <p>示例配置:</p>
 * <pre>
 * koduck:
 *   portfolio:
 *     cache:
 *       price-ttl: 30s
 *     calculation:
 *       max-positions: 100
 * </pre>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Data
@ConfigurationProperties(prefix = "koduck.portfolio")
public class PortfolioProperties {

    /** 缓存配置。 */
    private CacheConfig cache = new CacheConfig();

    /** 计算配置。 */
    private CalculationConfig calculation = new CalculationConfig();

    /** 价格服务配置。 */
    private PriceConfig price = new PriceConfig();

    /**
     * 缓存配置。
     */
    @Data
    public static class CacheConfig {
        /** 价格缓存 TTL。 */
        private String priceTtl = "30s";
        /** 组合快照缓存 TTL。 */
        private String snapshotTtl = "300s";
        /** 持仓缓存 TTL。 */
        private String positionTtl = "60s";
    }

    /**
     * 计算配置。
     */
    @Data
    public static class CalculationConfig {
        /** 最大持仓数量。 */
        private int maxPositions = 100;
        /** 价格精度（小数位）。 */
        private int pricePrecision = 4;
        /** 数量精度（小数位）。 */
        private int quantityPrecision = 2;
    }

    /**
     * 价格服务配置。
     */
    @Data
    public static class PriceConfig {
        /** 批量查询大小。 */
        private int batchSize = 50;
        /** 缓存刷新间隔（秒）。 */
        private int refreshInterval = 30;
    }
}
