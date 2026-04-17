package com.koduck.knowledge.config;

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
@EnableConfigurationProperties(KnowledgeDataSourceProperties.class)
public class DataSourceConfig {

    @Bean(name = "appDataSource")
    @Primary
    public DataSource appDataSource(final KnowledgeDataSourceProperties properties) {
        final HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(properties.getUrl());
        dataSource.setUsername(properties.getUsername());
        dataSource.setPassword(properties.getPassword());
        dataSource.setDriverClassName(properties.getDriverClassName());
        dataSource.setMaximumPoolSize(10);
        dataSource.setMinimumIdle(2);
        dataSource.setConnectionTimeout(30_000L);
        dataSource.setIdleTimeout(600_000L);
        dataSource.setMaxLifetime(1_800_000L);
        dataSource.setPoolName("KoduckKnowledgeHikariPool");
        return dataSource;
    }

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
