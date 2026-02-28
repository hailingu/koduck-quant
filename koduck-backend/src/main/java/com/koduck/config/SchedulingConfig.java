package com.koduck.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Enable scheduling and async support.
 */
@Configuration
@EnableScheduling
@EnableAsync
public class SchedulingConfig {
}
