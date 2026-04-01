package com.koduck.entity;

import com.koduck.util.CollectionCopyUtils;
import com.koduck.util.EntityCopyUtils;
import jakarta.persistence.*;
import lombok.Data;
import lombok.Setter;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 
 */
@Entity
@Table(name = "signal_comments")
@Data
@NoArgsConstructor
public class SignalComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "like_count")
    private Integer likeCount = 0;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    // 
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    // （）
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id", insertable = false, updatable = false)
    private SignalComment parent;

    // （）
    @OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
    private List<SignalComment> replies;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long id;
        private Long signalId;
        private Long userId;
        private Long parentId;
        private String content;
        private Integer likeCount;
        private Boolean isDeleted;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private CommunitySignal signal;
        private User user;
        private SignalComment parent;
        private List<SignalComment> replies;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder signalId(Long signalId) { this.signalId = signalId; return this; }
        public Builder userId(Long userId) { this.userId = userId; return this; }
        public Builder parentId(Long parentId) { this.parentId = parentId; return this; }
        public Builder content(String content) { this.content = content; return this; }
        public Builder likeCount(Integer likeCount) { this.likeCount = likeCount; return this; }
        public Builder isDeleted(Boolean isDeleted) { this.isDeleted = isDeleted; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }
        public Builder signal(CommunitySignal signal) { this.signal = EntityCopyUtils.copyCommunitySignal(signal); return this; }
        public Builder user(User user) { this.user = EntityCopyUtils.copyUser(user); return this; }
        public Builder parent(SignalComment parent) { this.parent = EntityCopyUtils.copySignalCommentShallow(parent); return this; }
        public Builder replies(List<SignalComment> replies) { this.replies = EntityCopyUtils.copySignalCommentShallowList(replies); return this; }

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

    public SignalComment getParent() {
        return EntityCopyUtils.copySignalCommentShallow(parent);
    }

    public void setParent(SignalComment parent) {
        this.parent = EntityCopyUtils.copySignalCommentShallow(parent);
    }

    public List<SignalComment> getReplies() {
        return CollectionCopyUtils.copyList(replies);
    }

    public void setReplies(List<SignalComment> replies) {
        this.replies = CollectionCopyUtils.copyList(replies);
    }
}
