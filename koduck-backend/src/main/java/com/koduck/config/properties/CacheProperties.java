package com.koduck.config.properties;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.validation.annotation.Validated;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

/**
 * Configuration properties for Redis cache TTL settings.
 * <p>
 * Values are populated from application configuration with prefix
 * {@code koduck.cache} and can be overridden per environment.
 * </p>
 *
 * @author Koduck Team
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.cache")
@Validated
@Slf4j
public class CacheProperties {

    /**
     * Default TTL for caches when no specific value is configured.
     */
    private Duration defaultTtl = Duration.ofMinutes(5);

    /**
     * TTL for K-line data snapshots.
     */
    private Duration klineTtl = Duration.ofMinutes(1);

    /**
     * TTL for latest price lookups.
     */
    private Duration priceTtl = Duration.ofSeconds(30);

    /**
     * TTL for market search results.
     */
    private Duration marketSearchTtl = Duration.ofMinutes(5);

    /**
     * TTL for stock detail payloads.
     */
    private Duration stockDetailTtl = Duration.ofSeconds(30);

    /**
     * TTL for major market index quotes.
     */
    private Duration marketIndicesTtl = Duration.ofSeconds(30);

    /**
     * TTL for stock industry metadata lookups.
     */
    private Duration stockIndustryTtl = Duration.ofMinutes(5);

    /**
     * TTL for hot stocks list responses.
     */
    private Duration hotStocksTtl = Duration.ofMinutes(1);

    /**
     * TTL for portfolio summary.
     */
    private Duration portfolioSummaryTtl = Duration.ofHours(1);

    /**
     * Logs the effective cache TTL configuration after construction.
     */
    @PostConstruct
    public void init() {
        log.info("[CacheProperties] defaultTtl={}, klineTtl={}, priceTtl={}, marketSearchTtl={}",
                defaultTtl, klineTtl, priceTtl, marketSearchTtl);
    }

    /**
     * Gets the default cache TTL.
     *
     * @return default TTL
     */
    public Duration getDefaultTtl() {
        return defaultTtl;
    }

    /**
     * Sets the default cache TTL.
     *
     * @param defaultTtl default TTL value
     */
    public void setDefaultTtl(Duration defaultTtl) {
        this.defaultTtl = defaultTtl;
    }

    /**
     * Gets the K-line cache TTL.
     *
     * @return K-line TTL
     */
    public Duration getKlineTtl() {
        return klineTtl;
    }

    /**
     * Sets the K-line cache TTL.
     *
     * @param klineTtl K-line TTL value
     */
    public void setKlineTtl(Duration klineTtl) {
        this.klineTtl = klineTtl;
    }

    /**
     * Gets the latest price cache TTL.
     *
     * @return price TTL
     */
    public Duration getPriceTtl() {
        return priceTtl;
    }

    /**
     * Sets the latest price cache TTL.
     *
     * @param priceTtl price TTL value
     */
    public void setPriceTtl(Duration priceTtl) {
        this.priceTtl = priceTtl;
    }

    /**
     * Gets the market search cache TTL.
     *
     * @return market search TTL
     */
    public Duration getMarketSearchTtl() {
        return marketSearchTtl;
    }

    /**
     * Sets the market search cache TTL.
     *
     * @param marketSearchTtl market search TTL value
     */
    public void setMarketSearchTtl(Duration marketSearchTtl) {
        this.marketSearchTtl = marketSearchTtl;
    }

    /**
     * Gets the stock detail cache TTL.
     *
     * @return stock detail TTL
     */
    public Duration getStockDetailTtl() {
        return stockDetailTtl;
    }

    /**
     * Sets the stock detail cache TTL.
     *
     * @param stockDetailTtl stock detail TTL value
     */
    public void setStockDetailTtl(Duration stockDetailTtl) {
        this.stockDetailTtl = stockDetailTtl;
    }

    /**
     * Gets the market indices cache TTL.
     *
     * @return market indices TTL
     */
    public Duration getMarketIndicesTtl() {
        return marketIndicesTtl;
    }

    /**
     * Sets the market indices cache TTL.
     *
     * @param marketIndicesTtl market indices TTL value
     */
    public void setMarketIndicesTtl(Duration marketIndicesTtl) {
        this.marketIndicesTtl = marketIndicesTtl;
    }

    /**
     * Gets the stock industry cache TTL.
     *
     * @return stock industry TTL
     */
    public Duration getStockIndustryTtl() {
        return stockIndustryTtl;
    }

    /**
     * Sets the stock industry cache TTL.
     *
     * @param stockIndustryTtl stock industry TTL value
     */
    public void setStockIndustryTtl(Duration stockIndustryTtl) {
        this.stockIndustryTtl = stockIndustryTtl;
    }

    /**
     * Gets the hot stocks cache TTL.
     *
     * @return hot stocks TTL
     */
    public Duration getHotStocksTtl() {
        return hotStocksTtl;
    }

    /**
     * Sets the hot stocks cache TTL.
     *
     * @param hotStocksTtl hot stocks TTL value
     */
    public void setHotStocksTtl(Duration hotStocksTtl) {
        this.hotStocksTtl = hotStocksTtl;
    }

    /**
     * Gets the portfolio summary cache TTL.
     *
     * @return portfolio summary TTL
     */
    public Duration getPortfolioSummaryTtl() {
        return portfolioSummaryTtl;
    }

    /**
     * Sets the portfolio summary cache TTL.
     *
     * @param portfolioSummaryTtl portfolio summary TTL value
     */
    public void setPortfolioSummaryTtl(Duration portfolioSummaryTtl) {
        this.portfolioSummaryTtl = portfolioSummaryTtl;
    }
}
