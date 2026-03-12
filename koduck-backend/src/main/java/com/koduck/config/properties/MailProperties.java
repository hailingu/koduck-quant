package com.koduck.config.properties;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 
 *
 * <p>: {@code koduck.mail}</p>
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.mail")
@Slf4j
public class MailProperties {

    /**
     * 
     */
    private boolean enabled = false;

    /**
     * 
     */
    private String from = "noreply@koduck.local";

    /**
     * 
     */
    private String fromName = "Koduck Quant";

    /**
     * （）
     */
    private int passwordResetTokenExpiryMinutes = 30;

    /**
     *  URL 
     *  {token} 
     */
    private String passwordResetUrlTemplate = "http://localhost:3000/reset-password?token={token}";

    @PostConstruct
    public void init() {
        log.info("[MailProperties] enabled={}, from={}, tokenExpiry={}min",
                enabled, from, passwordResetTokenExpiryMinutes);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getFrom() {
        return from;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public String getFromName() {
        return fromName;
    }

    public void setFromName(String fromName) {
        this.fromName = fromName;
    }

    public int getPasswordResetTokenExpiryMinutes() {
        return passwordResetTokenExpiryMinutes;
    }

    public void setPasswordResetTokenExpiryMinutes(int passwordResetTokenExpiryMinutes) {
        this.passwordResetTokenExpiryMinutes = passwordResetTokenExpiryMinutes;
    }

    public String getPasswordResetUrlTemplate() {
        return passwordResetUrlTemplate;
    }

    public void setPasswordResetUrlTemplate(String passwordResetUrlTemplate) {
        this.passwordResetUrlTemplate = passwordResetUrlTemplate;
    }

    /**
     * 
     *
     * @param token 
     * @return 
     */
    public String buildPasswordResetUrl(String token) {
        return passwordResetUrlTemplate.replace("{token}", token);
    }
}
