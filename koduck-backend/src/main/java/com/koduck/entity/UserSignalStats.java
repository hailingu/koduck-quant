package com.koduck.entity;

import com.koduck.util.EntityCopyUtils;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import lombok.Data;
import lombok.Setter;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

/**
 * 
 */
@Entity
@Table(name = "user_signal_stats")
@Data
@NoArgsConstructor
public class UserSignalStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(AccessLevel.NONE)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "total_signals")
    private Integer totalSignals = 0;
    
    public User getUser() {
        return EntityCopyUtils.copyUser(user);
    }
    
    public void setUser(User user) {
        this.user = EntityCopyUtils.copyUser(user);
    }

    @Column(name = "win_signals")
    private Integer winSignals = 0;

    @Column(name = "loss_signals")
    private Integer lossSignals = 0;

    @Column(name = "win_rate", precision = 5, scale = 2)
    private BigDecimal winRate;

    @Column(name = "avg_profit", precision = 19, scale = 4)
    private BigDecimal avgProfit;

    @Column(name = "follower_count")
    private Integer followerCount = 0;

    @Column(name = "reputation_score")
    private Integer reputationScore = 0;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // 
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    /**
     * 
     */
    public void calculateWinRate() {
        if (totalSignals != null && totalSignals > 0) {
            this.winRate = BigDecimal.valueOf(winSignals)
                    .multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(totalSignals), 2, RoundingMode.HALF_UP);
        } else {
            this.winRate = BigDecimal.ZERO;
        }
    }
}
