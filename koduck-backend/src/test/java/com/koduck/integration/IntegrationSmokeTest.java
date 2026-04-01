package com.koduck.integration;

import com.koduck.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CI integration smoke suite for infrastructure readiness.
 */
@AutoConfigureMockMvc(addFilters = false)
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
class IntegrationSmokeTest extends AbstractIntegrationTest {

    private final JdbcTemplate jdbcTemplate;
    private final MockMvc mockMvc;

    IntegrationSmokeTest(JdbcTemplate jdbcTemplate, MockMvc mockMvc) {
        this.jdbcTemplate = jdbcTemplate;
        this.mockMvc = mockMvc;
    }

    @Test
    @DisplayName("PostgreSQL connectivity should be ready")
    void shouldConnectToPostgres() {
        Integer one = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        assertThat(one).isEqualTo(1);
    }

    @Test
    @DisplayName("Health endpoint should be reachable")
    void shouldExposeHealthEndpoint() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }
}
