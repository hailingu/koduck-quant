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
 * 表示系统中权限的实体。
 * 定义资源和操作的访问控制规则。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "permissions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Permission {

    /**
     * 权限的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Integer id;

    /**
     * 权限的唯一代码。
     */
    @Column(nullable = false, unique = true, length = 100)
    private String code;

    /**
     * 权限的人类可读名称。
     */
    @Column(nullable = false, length = 100)
    private String name;

    /**
     * 此权限适用的资源。
     */
    @Column(length = 50)
    private String resource;

    /**
     * 资源上允许的操作。
     */
    @Column(length = 50)
    private String action;

    /**
     * 权限创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
