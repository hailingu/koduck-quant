package com.koduck.market.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Market 模块配置类。
 *
 * <p>启用 Market 模块的配置属性绑定。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Configuration
@EnableConfigurationProperties(MarketProperties.class)
public class MarketConfig {
    // 配置类，通过 @EnableConfigurationProperties 启用 MarketProperties
}
