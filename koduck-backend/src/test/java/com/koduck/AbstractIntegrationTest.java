package com.koduck;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * 共享集成测试基类：统一使用 PostgreSQL 连接配置。
 */
@SpringBootTest
@ActiveProfiles("integration-test")
public abstract class AbstractIntegrationTest {

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add(
                "spring.datasource.url",
                () ->
                        String.format(
                                "jdbc:postgresql://%s:%s/%s",
                                envOrDefault("DB_HOST", "localhost"),
                                envOrDefault("DB_PORT", "5432"),
                                envOrDefault("DB_NAME", "koduck_test")));
        registry.add("spring.datasource.username", () -> envOrDefault("DB_USERNAME", "koduck"));
        registry.add("spring.datasource.password", () -> envOrDefault("DB_PASSWORD", "koduck_test"));
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.flyway.enabled", () -> "true");
    }

    private static String envOrDefault(String key, String defaultValue) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return value;
    }
}
