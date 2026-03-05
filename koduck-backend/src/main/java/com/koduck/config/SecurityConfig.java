package com.koduck.config;

import com.koduck.security.JwtAuthenticationFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security configuration.
 *
 * <p>Defines stateless JWT-based authentication, public endpoint rules, and
 * authentication-related beans used across the application.</p>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private static final String AUTH_ENDPOINT_PATTERN = "/api/v1/auth/**";
    private static final String ACTUATOR_HEALTH_ENDPOINT = "/actuator/health";
    private static final String APP_HEALTH_ENDPOINT_PATTERN = "/api/v1/health/**";
    private static final String MARKET_ENDPOINT_PATTERN = "/api/v1/market/**";
    private static final String MONITORING_ENDPOINT_PATTERN = "/api/v1/monitoring/**";

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserDetailsService userDetailsService;

    /**
     * Builds the security filter chain and configures endpoint authorization.
     *
     * @param http Spring Security HTTP configuration builder
     * @return configured security filter chain
     * @throws Exception when the security configuration cannot be built
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exceptions ->
                exceptions.authenticationEntryPoint((request, response, authException) ->
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, authException.getMessage())))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    AUTH_ENDPOINT_PATTERN,
                    ACTUATOR_HEALTH_ENDPOINT,
                    APP_HEALTH_ENDPOINT_PATTERN,
                    MONITORING_ENDPOINT_PATTERN
                ).permitAll()
                .requestMatchers(HttpMethod.GET, MARKET_ENDPOINT_PATTERN).permitAll()
                .anyRequest().authenticated()
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Creates the authentication provider backed by {@link UserDetailsService}.
     *
     * @return configured authentication provider
     */
    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    /**
     * Exposes the application {@link AuthenticationManager}.
     *
     * @param config authentication configuration provided by Spring
     * @return authentication manager instance
     * @throws Exception when the authentication manager cannot be obtained
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * Creates the password encoder used for credential hashing.
     *
     * @return BCrypt password encoder
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
