package com.koduck.entity;

import java.time.LocalDateTime;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import com.koduck.util.CollectionCopyUtils;
import com.koduck.util.EntityCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Signal comment entity.
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "signal_comments")
@Data
@NoArgsConstructor
public class SignalComment {

    /**
     * Primary key.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * Signal ID.
     */
    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    /**
     * User ID.
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * Parent comment ID.
     */
    @Column(name = "parent_id")
    private Long parentId;

    /**
     * Comment content.
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /**
     * Like count.
     */
    @Column(name = "like_count")
    private Integer likeCount = 0;

    /**
     * Deleted flag.
     */
    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    /**
     * Created at.
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * Updated at.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Signal entity.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    /**
     * User entity.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * Parent comment.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", insertable = false, updatable = false)
    private SignalComment parent;

    /**
     * Reply comments.
     */
    @OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
    private List<SignalComment> replies;

    /**
     * Creates a new builder.
     *
     * @return Builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for SignalComment.
     */
    public static final class Builder {

        /**
         * The ID.
         */
        private Long id;

        /**
         * The signal ID.
         */
        private Long signalId;

        /**
         * The user ID.
         */
        private Long userId;

        /**
         * The parent comment ID.
         */
        private Long parentId;

        /**
         * The comment content.
         */
        private String content;

        /**
         * The like count.
         */
        private Integer likeCount;

        /**
         * The deleted flag.
         */
        private Boolean isDeleted;

        /**
         * The created at timestamp.
         */
        private LocalDateTime createdAt;

        /**
         * The updated at timestamp.
         */
        private LocalDateTime updatedAt;

        /**
         * The signal entity.
         */
        private CommunitySignal signal;

        /**
         * The user entity.
         */
        private User user;

        /**
         * The parent comment.
         */
        private SignalComment parent;

        /**
         * The reply comments.
         */
        private List<SignalComment> replies;

        /**
         * Sets the ID.
         *
         * @param id the ID
         * @return this builder
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * Sets the signal ID.
         *
         * @param signalId the signal ID
         * @return this builder
         */
        public Builder signalId(Long signalId) {
            this.signalId = signalId;
            return this;
        }

        /**
         * Sets the user ID.
         *
         * @param userId the user ID
         * @return this builder
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * Sets the parent ID.
         *
         * @param parentId the parent ID
         * @return this builder
         */
        public Builder parentId(Long parentId) {
            this.parentId = parentId;
            return this;
        }

        /**
         * Sets the content.
         *
         * @param content the content
         * @return this builder
         */
        public Builder content(String content) {
            this.content = content;
            return this;
        }

        /**
         * Sets the like count.
         *
         * @param likeCount the like count
         * @return this builder
         */
        public Builder likeCount(Integer likeCount) {
            this.likeCount = likeCount;
            return this;
        }

        /**
         * Sets the deleted flag.
         *
         * @param isDeleted the deleted flag
         * @return this builder
         */
        public Builder isDeleted(Boolean isDeleted) {
            this.isDeleted = isDeleted;
            return this;
        }

        /**
         * Sets the created at.
         *
         * @param createdAt the created at
         * @return this builder
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * Sets the updated at.
         *
         * @param updatedAt the updated at
         * @return this builder
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * Sets the signal.
         *
         * @param signal the signal
         * @return this builder
         */
        public Builder signal(CommunitySignal signal) {
            this.signal = EntityCopyUtils.copyCommunitySignal(signal);
            return this;
        }

        /**
         * Sets the user.
         *
         * @param user the user
         * @return this builder
         */
        public Builder user(User user) {
            this.user = EntityCopyUtils.copyUser(user);
            return this;
        }

        /**
         * Sets the parent.
         *
         * @param parent the parent
         * @return this builder
         */
        public Builder parent(SignalComment parent) {
            this.parent = EntityCopyUtils.copySignalCommentShallow(parent);
            return this;
        }

        /**
         * Sets the replies.
         *
         * @param replies the replies
         * @return this builder
         */
        public Builder replies(List<SignalComment> replies) {
            this.replies = EntityCopyUtils.copySignalCommentShallowList(replies);
            return this;
        }

        /**
         * Builds the SignalComment.
         *
         * @return the SignalComment
         */
        public SignalComment build() {
            SignalComment comment = new SignalComment();
            comment.id = id;
            comment.setSignalId(signalId);
            comment.setUserId(userId);
            comment.setParentId(parentId);
            comment.setContent(content);
            comment.setLikeCount(likeCount);
            comment.setIsDeleted(isDeleted);
            comment.createdAt = createdAt;
            comment.setUpdatedAt(updatedAt);
            comment.setSignal(signal);
            comment.setUser(user);
            comment.setParent(parent);
            comment.setReplies(replies);
            return comment;
        }
    }

    /**
     * Gets signal copy.
     *
     * @return signal copy
     */
    public CommunitySignal getSignal() {
        return EntityCopyUtils.copyCommunitySignal(signal);
    }

    /**
     * Sets signal with copy.
     *
     * @param signal the signal
     */
    public void setSignal(CommunitySignal signal) {
        this.signal = EntityCopyUtils.copyCommunitySignal(signal);
    }

    /**
     * Gets user copy.
     *
     * @return user copy
     */
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    /**
     * Sets user with copy.
     *
     * @param user the user
     */
    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }

    /**
     * Gets parent copy.
     *
     * @return parent copy
     */
    public SignalComment getParent() {
        return EntityCopyUtils.copySignalCommentShallow(parent);
    }

    /**
     * Sets parent with copy.
     *
     * @param parent the parent
     */
    public void setParent(SignalComment parent) {
        this.parent = EntityCopyUtils.copySignalCommentShallow(parent);
    }

    /**
     * Gets replies copy.
     *
     * @return replies copy
     */
    public List<SignalComment> getReplies() {
        return CollectionCopyUtils.copyList(replies);
    }

    /**
     * Sets replies with copy.
     *
     * @param replies the replies
     */
    public void setReplies(List<SignalComment> replies) {
        this.replies = CollectionCopyUtils.copyList(replies);
    }
}
