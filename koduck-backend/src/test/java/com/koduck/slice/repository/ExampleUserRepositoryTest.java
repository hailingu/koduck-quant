package com.koduck.slice.repository;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.koduck.config.TestDataFactory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Repository 切片测试示例（纯示例，不纳入默认 CI）
 *
 * 说明：
 * 1. 保留 slice 层示例代码结构，便于后续替换为真实 @DataJpaTest。
 * 2. 避免在示例中定义顶层 Repository 接口，防止污染 Spring 扫描上下文。
 */
@DisplayName("Repository 切片测试示例")
@Disabled("示例测试，默认不纳入 CI 执行")
class ExampleUserRepositoryTest {

    private Map<String, String> repository;

    @BeforeEach
    void setUp() {
        TestDataFactory.resetIdCounter();
        repository = new HashMap<>();
    }

    @Test
    @DisplayName("save and find: 示例仓储应返回保存的数据")
    void saveAndFind_shouldWorkForExample() {
        String username = TestDataFactory.nextName("user-");
        repository.put(username, "ok");

        assertThat(repository.get(username)).isEqualTo("ok");
    }
}
