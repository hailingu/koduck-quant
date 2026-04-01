package com.koduck.entity;

import com.koduck.util.EntityCopyUtils;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 
 */
@Entity
@Table(name = "signal_likes")
@Data
@NoArgsConstructor
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

    // 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    // 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long id;
        private Long signalId;
        private Long userId;
        private LocalDateTime createdAt;
        private CommunitySignal signal;
        private User user;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder signalId(Long signalId) { this.signalId = signalId; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder signal(CommunitySignal signal) { this.signal = EntityCopyUtils.copyCommunitySignal(signal); return this; }
        public Builder user(User user) { this.user = EntityCopyUtils.copyUser(user); return this; }

        public SignalLike build() {
            SignalLike like = new SignalLike();
            like.setId(id);
            like.setSignalId(signalId);
            like.setUserId(userId);
            like.setCreatedAt(createdAt);
            like.setSignal(signal);
            like.setUser(user);
            return like;
        }
    }

    public CommunitySignal getSignal() {
        return EntityCopyUtils.copyCommunitySignal(signal);
    }

    public void setSignal(CommunitySignal signal) {
        this.signal = EntityCopyUtils.copyCommunitySignal(signal);
    }

    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }
}
