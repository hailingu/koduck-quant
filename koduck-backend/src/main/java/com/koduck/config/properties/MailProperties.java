package com.koduck.config.properties;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 邮件服务配置属性
 *
 * <p>配置前缀: {@code koduck.mail}</p>
 */
@Configuration
@ConfigurationProperties(prefix = "koduck.mail")
@Slf4j
public class MailProperties {

    /**
     * 是否启用邮件服务
     */
    private boolean enabled = false;

    /**
     * 发件人地址
     */
    private String from = "noreply@koduck.local";

    /**
     * 发件人显示名称
     */
    private String fromName = "Koduck Quant";

    /**
     * 密码重置令牌有效期（分钟）
     */
    private int passwordResetTokenExpiryMinutes = 30;

    /**
     * 前端密码重置页面 URL 模板
     * 使用 {token} 作为令牌占位符
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
     * 生成密码重置链接
     *
     * @param token 重置令牌
     * @return 完整的重置链接
     */
    public String buildPasswordResetUrl(String token) {
        return passwordResetUrlTemplate.replace("{token}", token);
    }
}
