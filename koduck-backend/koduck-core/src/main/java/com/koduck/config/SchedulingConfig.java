package com.koduck.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 启用调度和异步支持。
 *
 * @author Koduck Team
 */
@Configuration
@EnableScheduling
@EnableAsync
public class SchedulingConfig {
}
