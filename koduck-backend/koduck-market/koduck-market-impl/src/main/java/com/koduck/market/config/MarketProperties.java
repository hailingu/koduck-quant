package com.koduck.market.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Market 模块配置属性。
 *
 * <p>配置前缀: {@code koduck.market}</p>
 *
 * <p>示例配置:</p>
 * <pre>
 * koduck:
 *   market:
 *     cache:
 *       price-ttl: 30s
 *     provider:
 *       default: akshare
 * </pre>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Data
@ConfigurationProperties(prefix = "koduck.market")
public class MarketProperties {

    /** 缓存配置。 */
    private CacheConfig cache = new CacheConfig();

    /** 数据提供商配置。 */
    private ProviderConfig provider = new ProviderConfig();

    /** 技术指标配置。 */
    private IndicatorConfig indicators = new IndicatorConfig();

    /**
     * 缓存配置。
     */
    @Data
    public static class CacheConfig {
        /** 价格缓存 TTL。 */
        private String priceTtl = "30s";
        /** K线数据缓存 TTL。 */
        private String klineTtl = "60s";
        /** 热门股票缓存 TTL。 */
        private String hotStocksTtl = "60s";
        /** 股票追踪缓存 TTL。 */
        private String trackTtl = "10s";
    }

    /**
     * 数据提供商配置。
     */
    @Data
    public static class ProviderConfig {
        /** 默认提供商。 */
        private String defaultProvider = "akshare";
        /** 请求超时（毫秒）。 */
        private int timeout = 10000;
        /** 重试次数。 */
        private int maxRetries = 3;
    }

    /**
     * 技术指标配置。
     */
    @Data
    public static class IndicatorConfig {
        /** 默认计算周期。 */
        private int defaultPeriod = 14;
        /** 支持的指标列表。 */
        private String supported = "SMA,EMA,MACD,RSI,KDJ,BOLL";
    }
}
