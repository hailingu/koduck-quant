package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
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
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSignalStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "total_signals")
    @Builder.Default
    private Integer totalSignals = 0;

    @Column(name = "win_signals")
    @Builder.Default
    private Integer winSignals = 0;

    @Column(name = "loss_signals")
    @Builder.Default
    private Integer lossSignals = 0;

    @Column(name = "win_rate", precision = 5, scale = 2)
    private BigDecimal winRate;

    @Column(name = "avg_profit", precision = 19, scale = 4)
    private BigDecimal avgProfit;

    @Column(name = "follower_count")
    @Builder.Default
    private Integer followerCount = 0;

    @Column(name = "reputation_score")
    @Builder.Default
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
