package com.koduck.entity;
import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import com.koduck.util.EntityCopyUtils;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 
 */
@Entity
@Table(name = "signal_subscriptions")
@Data
@NoArgsConstructor
public class SignalSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "notify_enabled")
    private Boolean notifyEnabled = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
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
        private Boolean notifyEnabled;
        private LocalDateTime createdAt;
        private CommunitySignal signal;
        private User user;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder signalId(Long signalId) { this.signalId = signalId; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder notifyEnabled(Boolean notifyEnabled) { this.notifyEnabled = notifyEnabled; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder signal(CommunitySignal signal) { this.signal = EntityCopyUtils.copyCommunitySignal(signal); return this; }
        public Builder user(User user) { this.user = EntityCopyUtils.copyUser(user); return this; }

        public SignalSubscription build() {
            SignalSubscription subscription = new SignalSubscription();
            subscription.id = id;
            subscription.setSignalId(signalId);
            subscription.setUserId(userId);
            subscription.setNotifyEnabled(notifyEnabled);
            subscription.createdAt = createdAt;
            subscription.setSignal(signal);
            subscription.setUser(user);
            return subscription;
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
