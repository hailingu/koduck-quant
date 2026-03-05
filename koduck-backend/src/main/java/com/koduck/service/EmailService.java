package com.koduck.service;

import com.koduck.config.properties.MailProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * 邮件服务
 *
 * <p>提供异步邮件发送功能，支持纯文本和 HTML 格式。</p>
 *
 * @author Koduck Team
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final MailProperties mailProperties;

    /**
     * 异步发送密码重置邮件
     *
     * <p>使用异步执行避免阻塞用户请求，邮件发送失败会被记录但不会抛出异常。</p>
     *
     * @param to           收件人邮箱
     * @param username     用户名（用于个性化邮件内容）
     * @param resetToken   重置令牌
     * @param resetUrl     重置链接
     */
    @Async
    public void sendPasswordResetEmail(String to, String username, String resetToken, String resetUrl) {
        if (!mailProperties.isEnabled()) {
            log.info("[EmailService] Mail service is disabled. Would have sent password reset email to {} with token {}",
                    to, maskToken(resetToken));
            return;
        }

        try {
            String subject = "【Koduck Quant】密码重置请求";
            String htmlContent = buildPasswordResetEmailHtml(username, resetUrl, resetToken);

            sendHtmlEmail(to, subject, htmlContent);
            log.info("[EmailService] Password reset email sent to {}", to);
        } catch (Exception e) {
            log.error("[EmailService] Failed to send password reset email to {}", to, e);
        }
    }

    /**
     * 发送纯文本邮件
     *
     * @param to      收件人
     * @param subject 主题
     * @param text    内容
     * @throws MailException 邮件发送异常
     */
    public void sendSimpleEmail(String to, String subject, String text) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailProperties.getFrom());
        message.setTo(to);
        message.setSubject(subject);
        message.setText(text);

        mailSender.send(message);
    }

    /**
     * 发送 HTML 邮件
     *
     * @param to           收件人
     * @param subject      主题
     * @param htmlContent  HTML 内容
     * @throws MessagingException 消息构建异常
     * @throws MailException      邮件发送异常
     */
    public void sendHtmlEmail(String to, String subject, String htmlContent) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        try {
            helper.setFrom(mailProperties.getFrom(), mailProperties.getFromName());
        } catch (java.io.UnsupportedEncodingException e) {
            // Fallback to simple from address if encoding fails
            helper.setFrom(mailProperties.getFrom());
        }
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlContent, true);

        mailSender.send(message);
    }

    /**
     * 构建密码重置邮件 HTML 内容
     */
    private String buildPasswordResetEmailHtml(String username, String resetUrl, String resetToken) {
        int expiryMinutes = mailProperties.getPasswordResetTokenExpiryMinutes();

        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .header h1 { color: white; margin: 0; font-size: 24px; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { margin-top: 30px; font-size: 12px; color: #666; }
                    .token-box { background: #e9ecef; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Koduck Quant</h1>
                    </div>
                    <div class="content">
                        <h2>密码重置请求</h2>
                        <p>您好 %s，</p>
                        <p>我们收到了您的密码重置请求。请点击下方按钮重置密码：</p>
                        <p style="text-align: center;">
                            <a href="%s" class="button">重置密码</a>
                        </p>
                        <p>或者复制以下链接到浏览器：</p>
                        <div class="token-box">%s</div>
                        <p><strong>注意：</strong>此链接将在 %d 分钟后失效。</p>
                        <p>如果您没有请求重置密码，请忽略此邮件。</p>
                        <div class="footer">
                            <p>此邮件由 Koduck Quant 系统自动发送，请勿回复。</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(username, resetUrl, resetUrl, expiryMinutes);
    }

    /**
     * 脱敏显示令牌
     */
    private String maskToken(String token) {
        if (token == null || token.length() < 8) {
            return "***";
        }
        return token.substring(0, 4) + "..." + token.substring(token.length() - 4);
    }
}
