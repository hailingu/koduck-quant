package com.koduck.slice.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.koduck.config.TestDataFactory;

/**
 * Repository slice test example (for demonstration only, not included in default CI).
 *
 * <p>Notes:
 * 1. Preserves slice layer example code structure for future replacement with real @DataJpaTest.
 * 2. Avoids defining top-level Repository interfaces in examples to prevent polluting Spring scan context.</p>
 *
 * @author Koduck Team
 */
@DisplayName("Repository Slice Test Example")
@Disabled("Example test, not included in CI by default")
class ExampleUserRepositoryTest {

    /** In-memory repository for testing. */
    private Map<String, String> repository;

    @BeforeEach
    void setUp() {
        TestDataFactory.resetIdCounter();
        repository = new HashMap<>();
    }

    @Test
    @DisplayName("save and find: example repository should return saved data")
    void saveAndFindShouldWorkForExample() {
        String username = TestDataFactory.nextName("user-");
        repository.put(username, "ok");

        assertThat(repository.get(username)).isEqualTo("ok");
    }
}
