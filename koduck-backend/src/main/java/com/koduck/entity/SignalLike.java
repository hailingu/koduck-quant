package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 信号点赞实体
 */
@Entity
@Table(name = "signal_likes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // 关联信号
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    // 关联用户
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;
}
