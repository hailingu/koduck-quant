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

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entity representing a user's subscription to a trading signal.
 * <p>
 * Stores the relationship between users and the signals they subscribe to,
 * along with notification preferences.
 *
 * @author Koduck
 */
@Entity
@Table(name = "signal_subscriptions")
@Data
@NoArgsConstructor
public class SignalSubscription {

    /**
     * Unique identifier for the subscription.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * Identifier of the signal being subscribed to.
     */
    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    /**
     * Identifier of the user who subscribed.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Flag indicating whether notifications are enabled for this subscription.
     */
    @Column(name = "notify_enabled")
    private Boolean notifyEnabled = true;

    /**
     * Timestamp when the subscription was created.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * The signal being subscribed to.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    /**
     * The user who subscribed.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * Creates a new builder instance for SignalSubscription.
     *
     * @return a new Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for constructing SignalSubscription instances.
     */
    public static final class Builder {

        /**
         * The subscription id.
         */
        private Long id;

        /**
         * The signal id.
         */
        private Long signalId;

        /**
         * The user id.
         */
        private Long userId;

        /**
         * Notification enabled flag.
         */
        private Boolean notifyEnabled;

        /**
         * Creation timestamp.
         */
        private LocalDateTime createdAt;

        /**
         * The associated signal.
         */
        private CommunitySignal signal;

        /**
         * The associated user.
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
            this.signal = EntityCopyUtils.copyCommunitySignal(signal);
            return this;
        }

        public Builder user(User user) {
            this.user = EntityCopyUtils.copyUser(user);
            return this;
        }

        /**
         * Builds a new SignalSubscription instance.
         *
         * @return the constructed SignalSubscription
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
