package com.koduck.unit.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.koduck.config.TestDataFactory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Service 层单元测试示例（与业务实现解耦）
 *
 * @author Koduck Team
 */
@DisplayName("服务层单元测试示例")
@Disabled("示例测试，默认不纳入 CI 执行")
class ExampleUserServiceTest {

    /** Service under test. */
    private UsernameService usernameService;

    @BeforeEach
    void setUp() {
        TestDataFactory.resetIdCounter();
        usernameService = new UsernameService();
    }

    @Test
    @DisplayName("buildUsername: 应生成统一前缀用户名")
    void buildUsernameShouldReturnExpectedValue() {
        long id = TestDataFactory.nextTestId();

        String actual = usernameService.buildUsername(id);

        assertThat(actual).isEqualTo("user-" + id);
    }

    @Test
    @DisplayName("normalizeUsername: 应去除首尾空白并转小写")
    void normalizeUsernameShouldTrimAndLowerCase() {
        String actual = usernameService.normalizeUsername("  Alice_01  ");

        assertThat(actual).isEqualTo("alice_01");
    }

    private static final class UsernameService {

        String buildUsername(long id) {
            return "user-" + id;
        }

        String normalizeUsername(String raw) {
            return raw == null ? "" : raw.trim().toLowerCase();
        }
    }
}
