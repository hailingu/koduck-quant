package com.koduck.entity.community;

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

import com.koduck.entity.auth.User;
import com.koduck.util.CollectionCopyUtils;
import com.koduck.util.EntityCopyUtils;
import com.koduck.util.CommunityEntityCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 信号评论实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "signal_comments")
@Data
@NoArgsConstructor
public class SignalComment {

    /**
     * 主键。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 信号 ID。
     */
    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    /**
     * 用户 ID。
     */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * 父评论 ID。
     */
    @Column(name = "parent_id")
    private Long parentId;

    /**
     * 评论内容。
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /**
     * 点赞数。
     */
    @Column(name = "like_count")
    private Integer likeCount = 0;

    /**
     * 删除标志。
     */
    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    /**
     * 创建时间。
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /**
     * 更新时间。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 信号实体。
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    /**
     * 用户实体。
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * 父评论。
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", insertable = false, updatable = false)
    private SignalComment parent;

    /**
     * 回复评论。
     */
    @OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
    private List<SignalComment> replies;

    /**
     * 创建新的构建器。
     *
     * @return 构建器实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * SignalComment 的构建器类。
     */
    public static final class Builder {

        /**
         * ID。
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
         * 父评论 ID。
         */
        private Long parentId;

        /**
         * 评论内容。
         */
        private String content;

        /**
         * 点赞数。
         */
        private Integer likeCount;

        /**
         * 删除标志。
         */
        private Boolean isDeleted;

        /**
         * 创建时间戳。
         */
        private LocalDateTime createdAt;

        /**
         * 更新时间戳。
         */
        private LocalDateTime updatedAt;

        /**
         * 信号实体。
         */
        private CommunitySignal signal;

        /**
         * 用户实体。
         */
        private User user;

        /**
         * 父评论。
         */
        private SignalComment parent;

        /**
         * 回复评论。
         */
        private List<SignalComment> replies;

        /**
         * 设置 ID。
         *
         * @param id ID
         * @return 此构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置信号 ID。
         *
         * @param signalId 信号 ID
         * @return 此构建器
         */
        public Builder signalId(Long signalId) {
            this.signalId = signalId;
            return this;
        }

        /**
         * 设置用户 ID。
         *
         * @param userId 用户 ID
         * @return 此构建器
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * 设置父 ID。
         *
         * @param parentId 父 ID
         * @return 此构建器
         */
        public Builder parentId(Long parentId) {
            this.parentId = parentId;
            return this;
        }

        /**
         * 设置内容。
         *
         * @param content 内容
         * @return 此构建器
         */
        public Builder content(String content) {
            this.content = content;
            return this;
        }

        /**
         * 设置点赞数。
         *
         * @param likeCount 点赞数
         * @return 此构建器
         */
        public Builder likeCount(Integer likeCount) {
            this.likeCount = likeCount;
            return this;
        }

        /**
         * 设置删除标志。
         *
         * @param isDeleted 删除标志
         * @return 此构建器
         */
        public Builder isDeleted(Boolean isDeleted) {
            this.isDeleted = isDeleted;
            return this;
        }

        /**
         * 设置创建时间。
         *
         * @param createdAt 创建时间
         * @return 此构建器
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * 设置更新时间。
         *
         * @param updatedAt 更新时间
         * @return 此构建器
         */
        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        /**
         * 设置信号。
         *
         * @param signal 信号
         * @return 此构建器
         */
        public Builder signal(CommunitySignal signal) {
            this.signal = CommunityEntityCopyUtils.copyCommunitySignal(signal);
            return this;
        }

        /**
         * 设置用户。
         *
         * @param user 用户
         * @return 此构建器
         */
        public Builder user(User user) {
            this.user = EntityCopyUtils.copyUser(user);
            return this;
        }

        /**
         * 设置父评论。
         *
         * @param parent 父评论
         * @return 此构建器
         */
        public Builder parent(SignalComment parent) {
            this.parent = CommunityEntityCopyUtils.copySignalCommentShallow(parent);
            return this;
        }

        /**
         * 设置回复。
         *
         * @param replies 回复
         * @return 此构建器
         */
        public Builder replies(List<SignalComment> replies) {
            this.replies = CommunityEntityCopyUtils.copySignalCommentShallowList(replies);
            return this;
        }

        /**
         * 构建 SignalComment。
         *
         * @return SignalComment
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
     * 获取信号副本。
     *
     * @return 信号副本
     */
    public CommunitySignal getSignal() {
        return CommunityEntityCopyUtils.copyCommunitySignal(signal);
    }

    /**
     * 使用副本设置信号。
     *
     * @param signal 信号
     */
    public void setSignal(CommunitySignal signal) {
        this.signal = CommunityEntityCopyUtils.copyCommunitySignal(signal);
    }

    /**
     * 获取用户副本。
     *
     * @return 用户副本
     */
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    /**
     * 使用副本设置用户。
     *
     * @param user 用户
     */
    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }

    /**
     * 获取父评论副本。
     *
     * @return 父评论副本
     */
    public SignalComment getParent() {
        return CommunityEntityCopyUtils.copySignalCommentShallow(parent);
    }

    /**
     * 使用副本设置父评论。
     *
     * @param parent 父评论
     */
    public void setParent(SignalComment parent) {
        this.parent = CommunityEntityCopyUtils.copySignalCommentShallow(parent);
    }

    /**
     * 获取回复副本。
     *
     * @return 回复副本
     */
    public List<SignalComment> getReplies() {
        return CollectionCopyUtils.copyList(replies);
    }

    /**
     * 使用副本设置回复。
     *
     * @param replies 回复
     */
    public void setReplies(List<SignalComment> replies) {
        this.replies = CollectionCopyUtils.copyList(replies);
    }
}
