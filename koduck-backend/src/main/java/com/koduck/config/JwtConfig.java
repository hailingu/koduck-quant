package com.koduck.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration properties for JSON Web Token (JWT) handling.
 * <p>
 * Bound from application properties with prefix {@code jwt}. Contains
 * secret key, expiration settings, and header/token prefix values used by
 * the security filters.
 */
@Data
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtConfig {

    /**
     * Secret key used to sign JWT tokens. Should be a secure random string.
     */
    private String secret;
    /**
     * Access token lifespan in milliseconds (default 24 hours).
     */
    private Long accessTokenExpiration = 86400000L;  // 24 hours
    /**
     * Refresh token lifespan in milliseconds (default 7 days).
     */
    private Long refreshTokenExpiration = 604800000L; // 7 days
    /**
     * Prefix applied to JWT in the Authorization header (default "Bearer ").
     */
    private String tokenPrefix = "Bearer ";
    /**
     * HTTP header name where the JWT is expected (default "Authorization").
     */
    private String headerName = "Authorization";
}
