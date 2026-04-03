package com.koduck.entity;

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

import com.koduck.util.EntityCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Entity for signal likes.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "signal_likes")
@Data
@NoArgsConstructor
public class SignalLike {

    /** The like ID. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** The signal ID. */
    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    /** The user ID. */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** The creation timestamp. */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** The associated signal. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    /** The associated user. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * Get a builder for SignalLike.
     *
     * @return the builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for SignalLike.
     */
    public static final class Builder {

        /** The like ID. */
        private Long id;

        /** The signal ID. */
        private Long signalId;

        /** The user ID. */
        private Long userId;

        /** The creation timestamp. */
        private LocalDateTime createdAt;

        /** The associated signal. */
        private CommunitySignal signal;

        /** The associated user. */
        private User user;

        /**
         * Set the ID.
         *
         * @param id the like ID
         * @return the builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Set the signal ID.
         *
         * @param signalId the signal ID
         * @return the builder
         */
        public Builder signalId(Long signalId) {
            this.signalId = signalId;
            return this;
        }

        /**
         * Set the user ID.
         *
         * @param userId the user ID
         * @return the builder
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * Set the creation timestamp.
         *
         * @param createdAt the creation timestamp
         * @return the builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Set the signal.
         *
         * @param signal the signal
         * @return the builder
         */
        public Builder signal(CommunitySignal signal) {
            this.signal = EntityCopyUtils.copyCommunitySignal(signal);
            return this;
        }

        /**
         * Set the user.
         *
         * @param user the user
         * @return the builder
         */
        public Builder user(User user) {
            this.user = EntityCopyUtils.copyUser(user);
            return this;
        }

        /**
         * Build the SignalLike.
         *
         * @return the SignalLike
         */
        public SignalLike build() {
            SignalLike like = new SignalLike();
            like.id = id;
            like.setSignalId(signalId);
            like.setUserId(userId);
            like.createdAt = createdAt;
            like.setSignal(signal);
            like.setUser(user);
            return like;
        }
    }

    /**
     * Get the signal with defensive copy.
     *
     * @return the signal
     */
    public CommunitySignal getSignal() {
        return EntityCopyUtils.copyCommunitySignal(signal);
    }

    /**
     * Set the signal with defensive copy.
     *
     * @param signal the signal
     */
    public void setSignal(CommunitySignal signal) {
        this.signal = EntityCopyUtils.copyCommunitySignal(signal);
    }

    /**
     * Get the user with defensive copy.
     *
     * @return the user
     */
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    /**
     * Set the user with defensive copy.
     *
     * @param user the user
     */
    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }
}
