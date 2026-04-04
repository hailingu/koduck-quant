package com.koduck;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Koduck Backend Bootstrap Application.
 *
 * <p>这是 Koduck 量化平台后端服务的启动入口。
 * 负责组装所有模块并启动 Spring Boot 应用。</p>
 *
 * @author Koduck Team
 * @version 0.1.0
 * @since 0.1.0
 */
@SpringBootApplication(scanBasePackages = "com.koduck")
@ConfigurationPropertiesScan
@EnableCaching
@EnableJpaAuditing
@EnableAsync
@EnableScheduling
public class KoduckBootstrapApplication {

    /**
     * 应用程序入口点。
     *
     * @param args 命令行参数
     */
    public static void main(String[] args) {
        SpringApplication.run(KoduckBootstrapApplication.class, args);
    }
}
