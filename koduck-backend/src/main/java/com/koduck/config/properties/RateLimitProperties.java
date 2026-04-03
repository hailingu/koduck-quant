package com.koduck.config.properties;

import java.time.Duration;
import java.util.Objects;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Configuration properties for Redis-based rate limiting.
 *
 * <p>Binds the {@code koduck.rate-limit} namespace and exposes independent
 * settings for login failure throttling and password reset throttling.</p>
 *
 * @param loginFailure login failure throttling settings
 * @param passwordReset password reset throttling settings
 *
 * @author GitHub Copilot
 */
@ConfigurationProperties(prefix = "koduck.rate-limit")
@Validated
public record RateLimitProperties(
        @DefaultValue LoginFailure loginFailure,
        @DefaultValue PasswordReset passwordReset) {

    /**
     * Creates configuration properties with constructor binding.
     *
     * @param loginFailure login failure throttling settings
     * @param passwordReset password reset throttling settings
     */
    public RateLimitProperties(
            @DefaultValue LoginFailure loginFailure,
            @DefaultValue PasswordReset passwordReset) {
        this.loginFailure = Objects.requireNonNull(loginFailure, "loginFailure must not be null");
        this.passwordReset = Objects.requireNonNull(passwordReset, "passwordReset must not be null");
    }

    /**
     * Gets login failure throttling settings.
     *
     * @return login failure settings
     */
    public LoginFailure getLoginFailure() {
        return loginFailure;
    }

    /**
     * Gets password reset throttling settings.
     *
     * @return password reset settings
     */
    public PasswordReset getPasswordReset() {
        return passwordReset;
    }

    /**
     * Login failure throttling configuration.
     */
    public static final class LoginFailure {

        /**
         * Default maximum failures per user.
         */
        private static final int DEFAULT_MAX_FAILURES_PER_USER = 5;

        /**
         * Default maximum failures per IP.
         */
        private static final int DEFAULT_MAX_FAILURES_PER_IP = 20;

        /**
         * Default window duration.
         */
        private static final Duration DEFAULT_WINDOW_DURATION = Duration.ofMinutes(15);

        /**
         * Maximum failures per user.
         */
        private final int maxFailuresPerUser;

        /**
         * Maximum failures per IP.
         */
        private final int maxFailuresPerIp;

        /**
         * Window duration.
         */
        private final Duration windowDuration;

        /**
         * Creates login failure settings with constructor binding.
         *
         * @param maxFailuresPerUser maximum failures per user
         * @param maxFailuresPerIp maximum failures per IP
         * @param windowDuration throttling window duration
         */
        public LoginFailure(
                @DefaultValue("5") @Min(1) int maxFailuresPerUser,
                @DefaultValue("20") @Min(1) int maxFailuresPerIp,
                @DefaultValue("15m") @NotNull Duration windowDuration) {
            this.maxFailuresPerUser = maxFailuresPerUser;
            this.maxFailuresPerIp = maxFailuresPerIp;
            this.windowDuration = Objects.requireNonNull(windowDuration, "windowDuration must not be null");
        }

        /**
         * Creates login failure settings using default values.
         */
        public LoginFailure() {
            this(
                    DEFAULT_MAX_FAILURES_PER_USER,
                    DEFAULT_MAX_FAILURES_PER_IP,
                    DEFAULT_WINDOW_DURATION);
        }

        /**
         * Gets maximum failed login attempts allowed per user.
         *
         * @return maximum failed login attempts per user
         */
        public int getMaxFailuresPerUser() {
            return maxFailuresPerUser;
        }

        /**
         * Gets maximum failed login attempts allowed per IP.
         *
         * @return maximum failed login attempts per IP
         */
        public int getMaxFailuresPerIp() {
            return maxFailuresPerIp;
        }

        /**
         * Gets the failure counter window duration.
         *
         * @return failure counter window duration
         */
        public Duration getWindowDuration() {
            return windowDuration;
        }
    }

    /**
     * Password reset throttling configuration.
     */
    public static final class PasswordReset {

        /**
         * Default maximum requests per user.
         */
        private static final int DEFAULT_MAX_REQUESTS_PER_USER = 3;

        /**
         * Default maximum requests per email.
         */
        private static final int DEFAULT_MAX_REQUESTS_PER_EMAIL = 5;

        /**
         * Default maximum requests per IP.
         */
        private static final int DEFAULT_MAX_REQUESTS_PER_IP = 10;

        /**
         * Default window duration.
         */
        private static final Duration DEFAULT_WINDOW_DURATION = Duration.ofHours(1);

        /**
         * Maximum requests per user.
         */
        private final int maxRequestsPerUser;

        /**
         * Maximum requests per email.
         */
        private final int maxRequestsPerEmail;

        /**
         * Maximum requests per IP.
         */
        private final int maxRequestsPerIp;

        /**
         * Window duration.
         */
        private final Duration windowDuration;

        /**
         * Creates password reset settings with constructor binding.
         *
         * @param maxRequestsPerUser maximum requests per user
         * @param maxRequestsPerEmail maximum requests per email
         * @param maxRequestsPerIp maximum requests per IP
         * @param windowDuration throttling window duration
         */
        public PasswordReset(
                @DefaultValue("3") @Min(1) int maxRequestsPerUser,
                @DefaultValue("5") @Min(1) int maxRequestsPerEmail,
                @DefaultValue("10") @Min(1) int maxRequestsPerIp,
                @DefaultValue("1h") @NotNull Duration windowDuration) {
            this.maxRequestsPerUser = maxRequestsPerUser;
            this.maxRequestsPerEmail = maxRequestsPerEmail;
            this.maxRequestsPerIp = maxRequestsPerIp;
            this.windowDuration = Objects.requireNonNull(windowDuration, "windowDuration must not be null");
        }

        /**
         * Creates password reset settings using default values.
         */
        public PasswordReset() {
            this(
                    DEFAULT_MAX_REQUESTS_PER_USER,
                    DEFAULT_MAX_REQUESTS_PER_EMAIL,
                    DEFAULT_MAX_REQUESTS_PER_IP,
                    DEFAULT_WINDOW_DURATION);
        }

        /**
         * Gets maximum password reset requests allowed per user.
         *
         * @return maximum password reset requests per user
         */
        public int getMaxRequestsPerUser() {
            return maxRequestsPerUser;
        }

        /**
         * Gets maximum password reset requests allowed per email.
         *
         * @return maximum password reset requests per email
         */
        public int getMaxRequestsPerEmail() {
            return maxRequestsPerEmail;
        }

        /**
         * Gets maximum password reset requests allowed per IP.
         *
         * @return maximum password reset requests per IP
         */
        public int getMaxRequestsPerIp() {
            return maxRequestsPerIp;
        }

        /**
         * Gets the password reset counter window duration.
         *
         * @return password reset counter window duration
         */
        public Duration getWindowDuration() {
            return windowDuration;
        }
    }
}
