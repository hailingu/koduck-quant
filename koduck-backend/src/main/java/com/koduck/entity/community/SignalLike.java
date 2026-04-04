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
 * 信号点赞实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "signal_likes")
@Data
@NoArgsConstructor
public class SignalLike {

    /** 点赞 ID。 */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /** 信号 ID。 */
    @Column(name = "signal_id", nullable = false)
    private Long signalId;

    /** 用户 ID。 */
    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** 创建时间戳。 */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** 关联的信号。 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    /** 关联的用户。 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * 获取 SignalLike 的构建器。
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * SignalLike 的构建器。
     */
    public static final class Builder {

        /** 点赞 ID。 */
        private Long id;

        /** 信号 ID。 */
        private Long signalId;

        /** 用户 ID。 */
        private Long userId;

        /** 创建时间戳。 */
        private LocalDateTime createdAt;

        /** 关联的信号。 */
        private CommunitySignal signal;

        /** 关联的用户。 */
        private User user;

        /**
         * 设置 ID。
         *
         * @param id 点赞 ID
         * @return 构建器
         */
        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        /**
         * 设置信号 ID。
         *
         * @param signalId 信号 ID
         * @return 构建器
         */
        public Builder signalId(Long signalId) {
            this.signalId = signalId;
            return this;
        }

        /**
         * 设置用户 ID。
         *
         * @param userId 用户 ID
         * @return 构建器
         */
        public Builder userId(Long userId) {
            this.userId = userId;
            return this;
        }

        /**
         * 设置创建时间戳。
         *
         * @param createdAt 创建时间戳
         * @return 构建器
         */
        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        /**
         * 设置信号。
         *
         * @param signal 信号
         * @return 构建器
         */
        public Builder signal(CommunitySignal signal) {
            this.signal = EntityCopyUtils.copyCommunitySignal(signal);
            return this;
        }

        /**
         * 设置用户。
         *
         * @param user 用户
         * @return 构建器
         */
        public Builder user(User user) {
            this.user = EntityCopyUtils.copyUser(user);
            return this;
        }

        /**
         * 构建 SignalLike。
         *
         * @return SignalLike
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
     * 获取带有防御性副本的信号。
     *
     * @return 信号
     */
    public CommunitySignal getSignal() {
        return EntityCopyUtils.copyCommunitySignal(signal);
    }

    /**
     * 使用防御性副本设置信号。
     *
     * @param signal 信号
     */
    public void setSignal(CommunitySignal signal) {
        this.signal = EntityCopyUtils.copyCommunitySignal(signal);
    }

    /**
     * 获取带有防御性副本的用户。
     *
     * @return 用户
     */
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    /**
     * 使用防御性副本设置用户。
     *
     * @param user 用户
     */
    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }
}
