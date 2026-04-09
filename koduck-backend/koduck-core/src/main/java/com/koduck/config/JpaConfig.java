package com.koduck.config;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * JPA configuration for multi-module entity/repository scanning.
 */
@Configuration
@EntityScan(basePackages = {"com.koduck"})
@EnableJpaRepositories(basePackages = {"com.koduck"})
public class JpaConfig {
}
