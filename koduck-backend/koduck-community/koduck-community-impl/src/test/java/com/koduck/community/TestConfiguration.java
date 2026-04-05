package com.koduck.community;

import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * Community 模块测试配置。
 *
 * @author Koduck Team
 * @since 0.1.0
 */
@SpringBootApplication(scanBasePackages = "com.koduck.community")
@EntityScan(basePackages = "com.koduck.community.entity")
@EnableJpaRepositories(basePackages = "com.koduck.community.repository")
public class TestConfiguration {
    // 测试配置类
}
