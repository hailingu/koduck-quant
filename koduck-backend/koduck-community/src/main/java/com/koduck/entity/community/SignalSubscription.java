package com.koduck.entity.community;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;

import com.koduck.entity.auth.User;
import com.koduck.util.EntityCopyUtils;
import com.koduck.util.CommunityEntityCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 表示用户对交易信号的订阅实体。
 * <p>
 * 存储用户与他们订阅的信号之间的关系，
 * 以及通知偏好设置。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "signal_subscriptions")
@Data
@NoArgsConstructor
public class SignalSubscription {

    /**
     * 订阅的唯一标识符。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 被订阅信号的标识符。
     */
    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    /**
     * 订阅用户的标识符。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 指示此订阅是否启用通知的标志。
     */
    @Column(name = "notify_enabled")
    private Boolean notifyEnabled = true;

    /**
     * 订阅创建时间戳。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 被订阅的信号。
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    /**
     * 订阅用户。
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * 创建 SignalSubscription 的新构建器实例。
     *
     * @return 新的构建器实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * 构建 SignalSubscription 实例的构建器类。
     */
    public static final class Builder {

        /**
         * 订阅 ID。
         */
        private Long id;

        /**
         * 信号 ID。
         */
        private Long signalId;

        /**
         * 用户 ID。
         */
        private Long userId;

        /**
         * 通知启用标志。
         */
        private Boolean notifyEnabled;

        /**
         * 创建时间戳。
         */
        private LocalDateTime createdAt;

        /**
         * 关联的信号。
         */
        private CommunitySignal signal;

        /**
         * 关联的用户。
         */
        private User user;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder signalId(Long signalId) {
            this.signalId = signalId;
            return this;
        }

        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        public Builder notifyEnabled(Boolean notifyEnabled) {
            this.notifyEnabled = notifyEnabled;
            return this;
        }

        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder signal(CommunitySignal signal) {
            this.signal = CommunityEntityCopyUtils.copyCommunitySignal(signal);
            return this;
        }

        public Builder user(User user) {
            this.user = EntityCopyUtils.copyUser(user);
            return this;
        }

        /**
         * 构建新的 SignalSubscription 实例。
         *
         * @return 构建的 SignalSubscription
         */
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
        return CommunityEntityCopyUtils.copyCommunitySignal(signal);
    }

    public void setSignal(CommunitySignal signal) {
        this.signal = CommunityEntityCopyUtils.copyCommunitySignal(signal);
    }

    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }
}
