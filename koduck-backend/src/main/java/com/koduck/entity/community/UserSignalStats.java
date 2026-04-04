package com.koduck.entity.community;
import com.koduck.entity.auth.User;

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

import com.koduck.util.EntityCopyUtils;

import lombok.AccessLevel;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * User signal statistics entity.
 *
 * @author koduck
 */
@Entity
@Table(name = "user_signal_stats")
@Data
@NoArgsConstructor
public class UserSignalStats {

    /**
     * Primary key ID.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    /**
     * User ID.
     */
    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    /**
     * Total number of signals.
     */
    @Column(name = "total_signals")
    private Integer totalSignals = 0;

    /**
     * Number of winning signals.
     */
    @Column(name = "win_signals")
    private Integer winSignals = 0;

    /**
     * Number of losing signals.
     */
    @Column(name = "loss_signals")
    private Integer lossSignals = 0;

    /**
     * Win rate percentage.
     */
    @Column(name = "win_rate", precision = 5, scale = 2)
    private BigDecimal winRate;

    /**
     * Average profit.
     */
    @Column(name = "avg_profit", precision = 19, scale = 4)
    private BigDecimal avgProfit;

    /**
     * Number of followers.
     */
    @Column(name = "follower_count")
    private Integer followerCount = 0;

    /**
     * Reputation score.
     */
    @Column(name = "reputation_score")
    private Integer reputationScore = 0;

    /**
     * Last update timestamp.
     */
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * Associated user entity.
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * Maximum win rate constant.
     */
    private static final int MAX_WIN_RATE = 100;

    /**
     * Get the associated user.
     *
     * @return the user
     */
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }

    /**
     * Set the associated user.
     *
     * @param user the user to set
     */
    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }

    /**
     * Calculate the win rate.
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
