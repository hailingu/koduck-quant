package com.koduck.entity;

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
 * Entity representing a permission in the system.
 * Defines access control rules for resources and actions.
 *
 * @author GitHub Copilot
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
     * Unique identifier for the permission.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Integer id;

    /**
     * Unique code for the permission.
     */
    @Column(nullable = false, unique = true, length = 100)
    private String code;

    /**
     * Human-readable name of the permission.
     */
    @Column(nullable = false, length = 100)
    private String name;

    /**
     * Resource this permission applies to.
     */
    @Column(length = 50)
    private String resource;

    /**
     * Action allowed on the resource.
     */
    @Column(length = 50)
    private String action;

    /**
     * Timestamp when the permission was created.
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;
}
