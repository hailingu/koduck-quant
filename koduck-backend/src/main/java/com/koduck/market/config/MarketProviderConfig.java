package com.koduck.market.config;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.koduck.market.provider.ProviderFactory;
import com.koduck.service.market.AKShareDataProvider;
import com.koduck.service.market.USStockProvider;

/**
 * Configuration for market data providers.
 * Registers all provider implementations on application startup.
 *
 * @author Koduck Team
 */
@Configuration
public class MarketProviderConfig {

    /**
     * Logger for this class.
     */
    private static final Logger LOG = LoggerFactory.getLogger(MarketProviderConfig.class);
    
    @Bean
    public ProviderFactory providerFactory() {
        return new ProviderFactory();
    }
    
    @Bean
    public ApplicationRunner registerProviders(ProviderFactory providerFactory, 
                                               AKShareDataProvider akShareDataProvider,
                                               USStockProvider usStockProvider) {
        return (ApplicationArguments args) -> {
            LOG.info("Registering market data providers...");
            
            // Register A-Share provider
            providerFactory.registerProvider(akShareDataProvider);
            LOG.info("Registered provider: {} for market {}", 
                    akShareDataProvider.getProviderName(), 
                    akShareDataProvider.getMarketType());
            
            // Register US Stock provider
            providerFactory.registerProvider(usStockProvider);
            LOG.info("Registered provider: {} for market {}", 
                    usStockProvider.getProviderName(), 
                    usStockProvider.getMarketType());
            
            // Log registered markets
            LOG.info("Supported markets: {}", providerFactory.getSupportedMarkets());
        };
    }
}
