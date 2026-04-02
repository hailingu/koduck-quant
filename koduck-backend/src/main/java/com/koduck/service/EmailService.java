package com.koduck.service;
import jakarta.mail.MessagingException;

/**
 * 邮件服务接口。
 *
 * <p>提供发送纯文本邮件、HTML 邮件以及密码重置邮件等功能。</p>
 *
 * @author Koduck Team
 */
public interface EmailService {

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
    void sendPasswordResetEmail(String to, String username, String resetToken, String resetUrl);

    /**
     * 发送纯文本邮件。
     *
     * @param to      收件人邮箱地址
     * @param subject 邮件主题
     * @param text    邮件正文（纯文本）
     */
    void sendSimpleEmail(String to, String subject, String text);

    /**
     * 发送 HTML 邮件。
     *
     * @param to           收件人邮箱地址
     * @param subject      邮件主题
     * @param htmlContent  HTML 格式的邮件正文
     * @throws MessagingException 当邮件构建或发送失败时抛出
     */
    void sendHtmlEmail(String to, String subject, String htmlContent) throws MessagingException;
}
