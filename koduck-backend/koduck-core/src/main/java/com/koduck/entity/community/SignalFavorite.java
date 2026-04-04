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
 * 表示用户收藏信号的实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "signal_favorites")
@Data
@NoArgsConstructor
public class SignalFavorite {

    /** 主键 ID。 */
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

    /** 收藏的备注。 */
    @Column(columnDefinition = "TEXT")
    private String note;

    /** 创建时间戳。 */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    @Setter(AccessLevel.NONE)
    private LocalDateTime createdAt;

    /** 关联的社区信号。 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signal_id", insertable = false, updatable = false)
    private CommunitySignal signal;

    /** 关联的用户。 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * 创建新的构建器实例。
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /** SignalFavorite 的构建器类。 */
    public static final class Builder {

        /** 构建器 ID 字段。 */
        private Long id;

        /** 构建器 signalId 字段。 */
        private Long signalId;

        /** 构建器 userId 字段。 */
        private Long userId;

        /** 构建器 note 字段。 */
        private String note;

        /** 构建器 createdAt 字段。 */
        private LocalDateTime createdAt;

        /** 构建器 signal 字段。 */
        private CommunitySignal signal;

        /** 构建器 user 字段。 */
        private User user;

        /**
         * 设置 ID。
         *
         * @param idValue ID
         * @return 构建器
         */
        public Builder id(Long idValue) {
            this.id = idValue;
            return this;
        }

        /**
         * 设置信号 ID。
         *
         * @param signalIdValue 信号 ID
         * @return 构建器
         */
        public Builder signalId(Long signalIdValue) {
            this.signalId = signalIdValue;
            return this;
        }

        /**
         * 设置用户 ID。
         *
         * @param userIdValue 用户 ID
         * @return 构建器
         */
        public Builder userId(Long userIdValue) {
            this.userId = userIdValue;
            return this;
        }

        /**
         * 设置备注。
         *
         * @param noteValue 备注
         * @return 构建器
         */
        public Builder note(String noteValue) {
            this.note = noteValue;
            return this;
        }

        /**
         * 设置创建时间戳。
         *
         * @param createdAtValue 创建时间戳
         * @return 构建器
         */
        public Builder createdAt(LocalDateTime createdAtValue) {
            this.createdAt = createdAtValue;
            return this;
        }

        /**
         * 设置信号。
         *
         * @param signalValue 信号
         * @return 构建器
         */
        public Builder signal(CommunitySignal signalValue) {
            this.signal = EntityCopyUtils.copyCommunitySignal(signalValue);
            return this;
        }

        /**
         * 设置用户。
         *
         * @param userValue 用户
         * @return 构建器
         */
        public Builder user(User userValue) {
            this.user = EntityCopyUtils.copyUser(userValue);
            return this;
        }

        /**
         * 构建 SignalFavorite 实例。
         *
         * @return SignalFavorite
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
     * @param signalValue 要设置的信号
     */
    public void setSignal(CommunitySignal signalValue) {
        this.signal = EntityCopyUtils.copyCommunitySignal(signalValue);
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
     * @param userValue 要设置的用户
     */
    public void setUser(User userValue) {
        this.user = EntityCopyUtils.copyUser(userValue);
    }
}
