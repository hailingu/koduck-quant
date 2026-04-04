package com.koduck.entity.community;
import com.koduck.entity.auth.User;

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
 * Entity representing a user's favorite signal.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "signal_favorites")
@Data
@NoArgsConstructor
public class SignalFavorite {

    /** Primary key ID. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** Signal ID. */
    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    /** User ID. */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** User note for the favorite. */
    @Column(columnDefinition = "TEXT")
    private String note;

    /** Creation timestamp. */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** Associated community signal. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    /** Associated user. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * Creates a new builder instance.
     *
     * @return the builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /** Builder class for SignalFavorite. */
    public static final class Builder {

        /** Builder ID field. */
        private Long id;

        /** Builder signalId field. */
        private Long signalId;

        /** Builder userId field. */
        private Long userId;

        /** Builder note field. */
        private String note;

        /** Builder createdAt field. */
        private LocalDateTime createdAt;

        /** Builder signal field. */
        private CommunitySignal signal;

        /** Builder user field. */
        private User user;

        /**
         * Sets the ID.
         *
         * @param idValue the ID
         * @return the builder
         */
        public Builder id(Long idValue) {
            this.id = idValue;
            return this;
        }

        /**
         * Sets the signal ID.
         *
         * @param signalIdValue the signal ID
         * @return the builder
         */
        public Builder signalId(Long signalIdValue) {
            this.signalId = signalIdValue;
            return this;
        }

        /**
         * Sets the user ID.
         *
         * @param userIdValue the user ID
         * @return the builder
         */
        public Builder userId(Long userIdValue) {
            this.userId = userIdValue;
            return this;
        }

        /**
         * Sets the note.
         *
         * @param noteValue the note
         * @return the builder
         */
        public Builder note(String noteValue) {
            this.note = noteValue;
            return this;
        }

        /**
         * Sets the created at timestamp.
         *
         * @param createdAtValue the created at timestamp
         * @return the builder
         */
        public Builder createdAt(LocalDateTime createdAtValue) {
            this.createdAt = createdAtValue;
            return this;
        }

        /**
         * Sets the signal.
         *
         * @param signalValue the signal
         * @return the builder
         */
        public Builder signal(CommunitySignal signalValue) {
            this.signal = EntityCopyUtils.copyCommunitySignal(signalValue);
            return this;
        }

        /**
         * Sets the user.
         *
         * @param userValue the user
         * @return the builder
         */
        public Builder user(User userValue) {
            this.user = EntityCopyUtils.copyUser(userValue);
            return this;
        }

        /**
         * Builds the SignalFavorite instance.
         *
         * @return the SignalFavorite
         */
        public SignalFavorite build() {
            SignalFavorite favorite = new SignalFavorite();
            favorite.id = id;
            favorite.setSignalId(signalId);
            favorite.setUserId(userId);
            favorite.setNote(note);
            favorite.createdAt = createdAt;
            favorite.setSignal(signal);
            favorite.setUser(user);
            return favorite;
        }
    }

    /**
     * Gets the signal with defensive copy.
     *
     * @return the signal
     */
    public CommunitySignal getSignal() {
        return EntityCopyUtils.copyCommunitySignal(signal);
    }

    /**
     * Sets the signal with defensive copy.
     *
     * @param signalValue the signal to set
     */
    public void setSignal(CommunitySignal signalValue) {
        this.signal = EntityCopyUtils.copyCommunitySignal(signalValue);
    }

    /**
     * Gets the user with defensive copy.
     *
     * @return the user
     */
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    /**
     * Sets the user with defensive copy.
     *
     * @param userValue the user to set
     */
    public void setUser(User userValue) {
        this.user = EntityCopyUtils.copyUser(userValue);
    }
}
