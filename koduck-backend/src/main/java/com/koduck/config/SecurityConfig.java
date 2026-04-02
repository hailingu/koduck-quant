package com.koduck.config;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.koduck.config.properties.SecurityEndpointProperties;
import com.koduck.security.JwtAuthenticationFilter;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Spring Security configuration.
 *
 * <p>Defines stateless JWT-based authentication, public endpoint rules, and
 * authentication-related beans used across the application.</p>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    /**
     * Builds the security filter chain and configures endpoint authorization.
     *
     * @param http Spring Security HTTP configuration builder
     * @param jwtAuthenticationFilter JWT filter used to authenticate incoming requests
     * @return configured security filter chain
     * @throws Exception when the security configuration cannot be built
     */
    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            UserDetailsService userDetailsService,
            SecurityEndpointProperties securityEndpointProperties) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exceptions ->
                exceptions.authenticationEntryPoint((request, response, authException) ->
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, authException.getMessage())))
            .authorizeHttpRequests(auth -> {
                // Allow async/error dispatches (e.g. SSE) to continue after initial auth passes.
                auth.dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll();

                String[] permitAllPatterns =
                        securityEndpointProperties.getPermitAllPatterns().toArray(String[]::new);
                if (permitAllPatterns.length > 0) {
                    auth.requestMatchers(permitAllPatterns).permitAll();
                }

                String[] permitAllGetPatterns =
                        securityEndpointProperties.getPermitAllGetPatterns().toArray(String[]::new);
                if (permitAllGetPatterns.length > 0) {
                    auth.requestMatchers(HttpMethod.GET, permitAllGetPatterns).permitAll();
                }

                auth.anyRequest().authenticated();
            })
            .authenticationProvider(authenticationProvider(userDetailsService))
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Creates the authentication provider backed by {@link UserDetailsService}.
     *
     * @param userDetailsService user details service used for authentication
     * @return configured authentication provider
     */
    @Bean
    public AuthenticationProvider authenticationProvider(UserDetailsService userDetailsService) {
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
