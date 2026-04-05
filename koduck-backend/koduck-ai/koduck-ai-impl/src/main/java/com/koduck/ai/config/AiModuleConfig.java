package com.koduck.ai.config;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

/**
 * AI 模块配置类。
 *
 * <p>本配置类启用 AI 模块的组件扫描，使 Spring 能够发现和注册 AI 服务。</p>
 *
 * @author Koduck AI Team
 * @since 0.1.0
 */
@Configuration
@ComponentScan(basePackages = {
        "com.koduck.service",
        "com.koduck.repository.ai"
})
public class AiModuleConfig {
    // 组件扫描配置
}
