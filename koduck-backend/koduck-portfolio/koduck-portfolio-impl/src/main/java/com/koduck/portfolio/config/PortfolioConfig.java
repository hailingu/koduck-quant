package com.koduck.portfolio.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Portfolio 模块配置类。
 *
 * <p>启用 Portfolio 模块的配置属性绑定。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Configuration
@EnableConfigurationProperties(PortfolioProperties.class)
public class PortfolioConfig {
    // 配置类，通过 @EnableConfigurationProperties 启用 PortfolioProperties
}
