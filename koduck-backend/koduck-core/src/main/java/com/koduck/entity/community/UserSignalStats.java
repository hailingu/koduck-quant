package com.koduck.entity.community;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.UpdateTimestamp;

import com.koduck.entity.auth.User;
import com.koduck.util.EntityCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 用户信号统计实体。
 *
 * @author Koduck Team
 */
@Entity
@Table(name = "user_signal_stats")
@Data
@NoArgsConstructor
public class UserSignalStats {

    /**
     * 主键 ID。
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * 用户 ID。
     */
    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /**
     * 信号总数。
     */
    @Column(name = "total_signals")
    private Integer totalSignals = 0;

    /**
     * 盈利信号数。
     */
    @Column(name = "win_signals")
    private Integer winSignals = 0;

    /**
     * 亏损信号数。
     */
    @Column(name = "loss_signals")
    private Integer lossSignals = 0;

    /**
     * 胜率百分比。
     */
    @Column(name = "win_rate", precision = 5, scale = 2)
    private BigDecimal winRate;

    /**
     * 平均盈利。
     */
    @Column(name = "avg_profit", precision = 19, scale = 4)
    private BigDecimal avgProfit;

    /**
     * 关注者数量。
     */
    @Column(name = "follower_count")
    private Integer followerCount = 0;

    /**
     * 声誉评分。
     */
    @Column(name = "reputation_score")
    private Integer reputationScore = 0;

    /**
     * 最后更新时间戳。
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 关联的用户实体。
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * 最大胜率常量。
     */
    private static final int MAX_WIN_RATE = 100;

    /**
     * 获取关联的用户。
     *
     * @return 用户
     */
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    /**
     * 设置关联的用户。
     *
     * @param user 要设置的用户
     */
    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }

    /**
     * 计算胜率。
     */
    public void calculateWinRate() {
        if (totalSignals != null && totalSignals > 0) {
            this.winRate = BigDecimal.valueOf(winSignals)
                    .multiply(BigDecimal.valueOf(MAX_WIN_RATE))
                    .divide(BigDecimal.valueOf(totalSignals), 2, RoundingMode.HALF_UP);
        }
        else {
            this.winRate = BigDecimal.ZERO;
        }
    }
}
