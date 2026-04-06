package com.koduck.config;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;

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

import com.koduck.infrastructure.config.properties.SecurityEndpointProperties;
import com.koduck.security.JwtAuthenticationFilter;

/**
 * Spring Security 安全配置。
 *
 * <p>Defines stateless JWT-based authentication, public endpoint rules, and
 * authentication-related beans used across the application.</p>
 *
 * @author GitHub Copilot
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    /**
     * 构建安全过滤器链并配置端点授权。
     *
     * @param http Spring Security HTTP 配置构建器
     * @param jwtAuthenticationFilter 用于认证传入请求的 JWT 过滤器
     * @param userDetailsService 认证用的用户详情服务
     * @param securityEndpointProperties 安全端点配置属性
     * @return 配置的安全过滤器链
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
     * 创建由 {UserDetailsService} 支持的认证提供者。
     *
     * @param userDetailsService user details service used for authentication
     * @return 配置的认证提供者
     */
    @Bean
    public AuthenticationProvider authenticationProvider(UserDetailsService userDetailsService) {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    /**
     * 暴露应用的 {AuthenticationManager}。
     *
     * @param config Spring 提供的认证配置
     * @return 认证管理器实例
     * @throws Exception when the authentication manager cannot be obtained
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    /**
     * 创建用于凭证哈希的密码编码器。
     *
     * @return BCrypt 密码编码器
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
