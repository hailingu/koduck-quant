package com.koduck.service.impl.user;

import java.util.Objects;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.koduck.config.properties.MailProperties;
import com.koduck.service.EmailService;

import lombok.extern.slf4j.Slf4j;

/**
 * 邮件服务实现类。
 *
 * <p>提供发送纯文本邮件、HTML 邮件以及密码重置邮件等功能。</p>
 *
 * @author Koduck Team
 */
@Slf4j
@Service
public class EmailServiceImpl implements EmailService {

    /** Minimum token length for masking. */
    private static final int MIN_TOKEN_LENGTH = 8;

    /** Number of characters to show at start/end of masked token. */
    private static final int MASK_VISIBLE_CHARS = 4;

    /** HTML email template for password reset. */
    private static final String PASSWORD_RESET_EMAIL_TEMPLATE = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 30px;
                    text-align: center;
                    border-radius: 8px 8px 0 0;
                }
                .header h1 {
                    color: white;
                    margin: 0;
                    font-size: 24px;
                }
                .content {
                    background: #f9f9f9;
                    padding: 30px;
                    border-radius: 0 0 8px 8px;
                }
                .button {
                    display: inline-block;
                    background: #667eea;
                    color: white;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 30px;
                    font-size: 12px;
                    color: #666;
                }
                .token-box {
                    background: #e9ecef;
                    padding: 10px;
                    border-radius: 4px;
                    font-family: monospace;
                    word-break: break-all;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Koduck Quant</h1>
                </div>
                <div class="content">
                    <h2>密码重置请求</h2>
                    <p>您好 {USERNAME}，</p>
                    <p>我们收到了您的密码重置请求。请点击下方按钮重置密码：</p>
                    <p style="text-align: center;">
                        <a href="{RESET_URL}" class="button">重置密码</a>
                    </p>
                    <p>或者复制以下链接到浏览器：</p>
                    <div class="token-box">{RESET_TOKEN}</div>
                    <p><strong>注意：</strong>此链接将在 {EXPIRY_MINUTES} 分钟后失效。</p>
                    <p>如果您没有请求重置密码，请忽略此邮件。</p>
                    <div class="footer">
                        <p>此邮件由 Koduck Quant 系统自动发送，请勿回复。</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """;

    /** Sender for Java mail. */
    private final JavaMailSender mailSender;

    /** Configuration properties for mail. */
    private final MailProperties mailProperties;

    /**
     * Constructs a new EmailServiceImpl.
     *
     * @param mailSender the Java mail sender
     * @param mailProperties the mail properties configuration
     */
    public EmailServiceImpl(JavaMailSender mailSender, MailProperties mailProperties) {
        this.mailSender = Objects.requireNonNull(mailSender, "mailSender must not be null");
        this.mailProperties = Objects.requireNonNull(mailProperties, "mailProperties must not be null");
    }

    /**
     * 发送密码重置邮件。
     *
     * <p>异步发送包含密码重置链接的 HTML 邮件。</p>
     *
     * @param to           收件人邮箱地址
     * @param username     用户名（用于邮件内容显示）
     * @param resetToken   密码重置令牌
     * @param resetUrl     密码重置链接
     */
    @Override
    @Async
    public void sendPasswordResetEmail(String to, String username, String resetToken, String resetUrl) {
        if (!mailProperties.isEnabled()) {
            log.info("[EmailService] Mail service is disabled. "
                    + "Would have sent password reset email to {} with token {}",
                    to, maskToken(resetToken));
            return;
        }
        try {
            String subject = "【Koduck Quant】密码重置请求";
            String htmlContent = buildPasswordResetEmailHtml(username, resetUrl, resetToken);
            sendHtmlEmail(to, subject, htmlContent);
            log.info("[EmailService] Password reset email sent to {}", to);
        }
        catch (Exception e) {
            log.error("[EmailService] Failed to send password reset email to {}", to, e);
        }
    }

    /**
     * 发送纯文本邮件。
     *
     * @param to      收件人邮箱地址
     * @param subject 邮件主题
     * @param text    邮件正文（纯文本）
     */
    @Override
    public void sendSimpleEmail(String to, String subject, String text) {
        String nonNullTo = Objects.requireNonNull(to, "to must not be null");
        String nonNullSubject = Objects.requireNonNull(subject, "subject must not be null");
        String nonNullText = Objects.requireNonNull(text, "text must not be null");
        String from = Objects.requireNonNull(mailProperties.getFrom(), "mail.from must not be null");
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(nonNullTo);
        message.setSubject(nonNullSubject);
        message.setText(nonNullText);
        mailSender.send(message);
    }

    /**
     * 发送 HTML 邮件。
     *
     * @param to           收件人邮箱地址
     * @param subject      邮件主题
     * @param htmlContent  HTML 格式的邮件正文
     * @throws MessagingException 当邮件构建或发送失败时抛出
     */
    @Override
    public void sendHtmlEmail(String to, String subject, String htmlContent) throws MessagingException {
        String nonNullTo = Objects.requireNonNull(to, "to must not be null");
        String nonNullSubject = Objects.requireNonNull(subject, "subject must not be null");
        String nonNullHtmlContent = Objects.requireNonNull(htmlContent, "htmlContent must not be null");
        String from = Objects.requireNonNull(mailProperties.getFrom(), "mail.from must not be null");
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        try {
            String fromName = mailProperties.getFromName();
            if (fromName != null && !fromName.isBlank()) {
                helper.setFrom(from, fromName);
            }
            else {
                helper.setFrom(from);
            }
        }
        catch (java.io.UnsupportedEncodingException e) {
            // Fallback to simple from address if encoding fails
            helper.setFrom(from);
        }
        helper.setTo(nonNullTo);
        helper.setSubject(nonNullSubject);
        helper.setText(nonNullHtmlContent, true);
        mailSender.send(message);
    }

    /**
     * 构建密码重置邮件的 HTML 内容。
     *
     * @param username   the username
     * @param resetUrl   the reset URL
     * @param resetToken the reset token
     * @return the HTML content
     */
    private String buildPasswordResetEmailHtml(String username, String resetUrl, String resetToken) {
        int expiryMinutes = mailProperties.getPasswordResetTokenExpiryMinutes();
        return PASSWORD_RESET_EMAIL_TEMPLATE
                .replace("{USERNAME}", username)
                .replace("{RESET_URL}", resetUrl)
                .replace("{RESET_TOKEN}", resetToken)
                .replace("{EXPIRY_MINUTES}", String.valueOf(expiryMinutes));
    }

    /**
     * 掩码处理令牌，用于日志显示。
     *
     * @param token the token to mask
     * @return the masked token
     */
    private String maskToken(String token) {
        if (token == null || token.length() < MIN_TOKEN_LENGTH) {
            return "***";
        }
        return token.substring(0, MASK_VISIBLE_CHARS)
                + "..."
                + token.substring(token.length() - MASK_VISIBLE_CHARS);
    }
}
