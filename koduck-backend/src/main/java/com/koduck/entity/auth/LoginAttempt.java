package com.koduck.entity.auth;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 登录尝试记录实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "login_attempts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginAttempt {

    /**
     * 登录尝试的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 登录标识符（用户名或 IP 地址）。
     */
    @Column(nullable = false, length = 100)
    private String identifier;

    /**
     * 登录尝试类型（账户或 IP）。
     */
    @Column(nullable = false, length = 20)
    private String type;

    /**
     * 登录尝试的 IP 地址。
     */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /**
     * 客户端的用户代理字符串。
     */
    @Column(name = "user_agent", length = 500)
    private String userAgent;

    /**
     * 登录尝试是否成功。
     */
    @Column(nullable = false)
    private Boolean success;

    /**
     * 登录尝试创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
