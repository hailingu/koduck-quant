package com.koduck.ai.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * AI 模块配置类。
 *
 * <p>启用 AI 模块的配置属性绑定。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Configuration
@EnableConfigurationProperties(AiProperties.class)
public class AiModuleConfig {
    // 配置类，通过 @EnableConfigurationProperties 启用 AiProperties
}
