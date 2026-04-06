package com.koduck.infrastructure.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * 事件配置类。
 *
 * <p>启用异步事件处理支持。</p>
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@Configuration
@EnableAsync
public class EventConfig {
    // 异步事件配置由 @EnableAsync 启用
    // 线程池配置可在 application.yml 中定义
}
