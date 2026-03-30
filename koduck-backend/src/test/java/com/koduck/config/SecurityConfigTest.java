package com.koduck.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.ReflectionTestUtils;

import com.koduck.util.JwtUtil;
import com.koduck.security.JwtAuthenticationFilter;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lightweight security configuration tests for endpoint authorization rules.
 */
@WebMvcTest(controllers = SecurityTestEndpointsController.class)
@Import({SecurityConfig.class, SecurityConfigTest.SecurityTestBeans.class})
@ActiveProfiles("security-config-test")
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    /**
     * Verifies that configured public GET endpoints are accessible without authentication.
     *
     * @throws Exception when request execution fails
     */
    @Test
    @DisplayName("shouldPermitConfiguredPublicEndpointsWithoutAuthentication")
    void shouldPermitConfiguredPublicEndpointsWithoutAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/auth/ping")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/health/ping")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/market/ping")).andExpect(status().isOk());
    }

    /**
     * Verifies that non-public endpoints require authentication.
     *
     * @throws Exception when request execution fails
     */
    @Test
    @DisplayName("shouldRequireAuthenticationForOtherEndpoints")
    void shouldRequireAuthenticationForOtherEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/private/ping"))
                .andExpect(status().isUnauthorized())
            .andExpect(result -> org.assertj.core.api.Assertions
                .assertThat(result.getResponse().getErrorMessage())
                .contains("authentication")
                .contains("required"));
    }

    /**
     * Test security beans required by {@link SecurityConfig}.
     */
    @TestConfiguration
    static class SecurityTestBeans {

        /**
         * Creates JWT configuration used by security components in tests.
         *
         * @return jwt configuration with a test secret
         */
        @Bean
        JwtConfig jwtConfig() {
            JwtConfig config = new JwtConfig();
            config.setSecret("12345678901234567890123456789012");
            return config;
        }

        /**
         * Creates JWT utility for filter construction in tests.
         *
         * @param jwtConfig jwt configuration
         * @return jwt utility instance
         */
        @Bean
        JwtUtil jwtUtil(JwtConfig jwtConfig) {
            JwtUtil jwtUtil = new JwtUtil();
            ReflectionTestUtils.setField(jwtUtil, "jwtConfig", jwtConfig);
            return jwtUtil;
        }

        /**
         * Provides a minimal user-details service for test context wiring.
         *
         * @return user-details service
         */
        @Bean
        UserDetailsService userDetailsService() {
            return username -> {
                throw new UsernameNotFoundException("User not found: " + username);
            };
        }

        /**
         * Creates JWT authentication filter used in the filter chain.
         *
         * @param jwtUtil jwt utility
         * @param jwtConfig jwt configuration
         * @param userDetailsService user-details service
         * @return jwt authentication filter
         */
        @Bean
        JwtAuthenticationFilter jwtAuthenticationFilter(
                JwtUtil jwtUtil,
                JwtConfig jwtConfig,
                UserDetailsService userDetailsService) {
            JwtAuthenticationFilter filter = new JwtAuthenticationFilter();
            ReflectionTestUtils.setField(filter, "jwtUtil", jwtUtil);
            ReflectionTestUtils.setField(filter, "jwtConfig", jwtConfig);
            ReflectionTestUtils.setField(filter, "userDetailsService", userDetailsService);
            return filter;
        }
    }

}
