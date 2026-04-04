package com.koduck.config.properties;

import jakarta.annotation.PostConstruct;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import lombok.extern.slf4j.Slf4j;

/**
 * Configuration properties for email service and password reset flows.
 * <p>
 * Binds the configuration prefix {@code koduck.mail} and provides helper methods
 * for building password reset URLs.
 * </p>
 *
 * @see <a href="https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/#features.external-config.typesafe-configuration-properties">Spring Boot Configuration Properties</a>
 * @author GitHub Copilot
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.mail")
@Slf4j
public class MailProperties {

    /**
     * Default password reset token expiry time in minutes.
     */
    private static final int DEFAULT_TOKEN_EXPIRY_MINUTES = 30;

    /**
     * Whether email sending is enabled.
     */
    private boolean enabled = false;

    /**
     * Email address used in the From header for outbound emails.
     */
    private String from = "noreply@koduck.local";

    /**
     * Display name used in the From header for outbound emails.
     */
    private String fromName = "Koduck Quant";

    /**
     * Password reset token expiry time in minutes.
     */
    private int passwordResetTokenExpiryMinutes = DEFAULT_TOKEN_EXPIRY_MINUTES;

    /**
     * Template for password reset URL. The token placeholder must be {@code {token}}.
     */
    private String passwordResetUrlTemplate = "http://localhost:3000/reset-password?token={token}";

    @PostConstruct
    public void init() {
        log.info("[MailProperties] enabled={}, from={}, tokenExpiry={}min",
                enabled, from, passwordResetTokenExpiryMinutes);
    }

    /**
     * Returns whether mail gateway is enabled.
     *
     * @return true if enabled, false otherwise
     */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Sets whether mail gateway is enabled.
     *
     * @param enabled true to enable, false to disable
     */
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    /**
     * Returns the configured sender address.
     *
     * @return sender address
     */
    public String getFrom() {
        return from;
    }

    /**
     * Sets the sender email address.
     *
     * @param from sender email address
     */
    public void setFrom(String from) {
        this.from = from;
    }

    /**
     * Returns the sender display name.
     *
     * @return sender display name
     */
    public String getFromName() {
        return fromName;
    }

    /**
     * Sets the sender display name.
     *
     * @param fromName sender display name
     */
    public void setFromName(String fromName) {
        this.fromName = fromName;
    }

    /**
     * Returns password reset token expiry in minutes.
     *
     * @return expiry in minutes
     */
    public int getPasswordResetTokenExpiryMinutes() {
        return passwordResetTokenExpiryMinutes;
    }

    /**
     * Sets password reset token expiry in minutes.
     *
     * @param passwordResetTokenExpiryMinutes expiry in minutes
     */
    public void setPasswordResetTokenExpiryMinutes(int passwordResetTokenExpiryMinutes) {
        this.passwordResetTokenExpiryMinutes = passwordResetTokenExpiryMinutes;
    }

    /**
     * Returns password reset URL template.
     *
     * @return URL template with {@code {token}} placeholder
     */
    public String getPasswordResetUrlTemplate() {
        return passwordResetUrlTemplate;
    }

    /**
     * Sets password reset URL template.
     *
     * @param passwordResetUrlTemplate URL template with {@code {token}} placeholder
     */
    public void setPasswordResetUrlTemplate(String passwordResetUrlTemplate) {
        this.passwordResetUrlTemplate = passwordResetUrlTemplate;
    }

    /**
     * Builds a password reset URL by replacing the token placeholder.
     *
     * @param token password reset token, must not be null or empty
     * @return resolved URL
     */
    public String buildPasswordResetUrl(String token) {
        if (token == null) {
            throw new IllegalArgumentException("token must not be null");
        }
        return passwordResetUrlTemplate.replace("{token}", token);
    }
}
