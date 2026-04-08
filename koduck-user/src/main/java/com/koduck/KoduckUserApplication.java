package com.koduck;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Koduck User Service Application.
 *
 * <p>用户管理独立服务启动入口，负责用户信息管理、角色权限管理。</p>
 *
 * @author Koduck Team
 * @version 0.1.0
 * @since 0.1.0
 */
@SpringBootApplication(scanBasePackages = "com.koduck")
@ConfigurationPropertiesScan
@EnableJpaAuditing
public class KoduckUserApplication {

    /**
     * 应用程序入口点。
     *
     * @param args 命令行参数
     */
    public static void main(String[] args) {
        SpringApplication.run(KoduckUserApplication.class, args);
    }
}
