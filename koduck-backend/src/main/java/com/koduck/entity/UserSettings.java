package com.koduck.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 用户设置实体
 */
@Entity
@Table(name = "user_settings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    // 主题设置
    @Column(name = "theme", nullable = false, length = 20)
    @Builder.Default
    private String theme = "light";

    @Column(name = "language", nullable = false, length = 10)
    @Builder.Default
    private String language = "zh-CN";

    @Column(name = "timezone", nullable = false, length = 50)
    @Builder.Default
    private String timezone = "Asia/Shanghai";

    // 通知设置
    @Column(name = "notification_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private NotificationConfig notificationConfig = new NotificationConfig();

    // 交易设置
    @Column(name = "trading_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private TradingConfig tradingConfig = new TradingConfig();

    // 显示设置
    @Column(name = "display_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private DisplayConfig displayConfig = new DisplayConfig();

    // 快捷入口
    @Column(name = "quick_links", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private List<QuickLink> quickLinks = List.of();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 通知配置
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class NotificationConfig {
        @Builder.Default
        private Boolean email = true;
        @Builder.Default
        private Boolean browser = true;
        @Builder.Default
        private Boolean priceAlert = true;
        @Builder.Default
        private Boolean tradeAlert = true;
        @Builder.Default
        private Boolean strategyAlert = true;
    }

    /**
     * 交易配置
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TradingConfig {
        @Builder.Default
        private String defaultMarket = "US";
        @Builder.Default
        private Double commissionRate = 0.001;
        @Builder.Default
        private Double minCommission = 0.0;
        @Builder.Default
        private Boolean enableConfirmation = true;
    }

    /**
     * 显示配置
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DisplayConfig {
        @Builder.Default
        private String currency = "USD";
        @Builder.Default
        private String dateFormat = "YYYY-MM-DD";
        @Builder.Default
        private String numberFormat = "comma";
        @Builder.Default
        private Boolean compactMode = false;
    }

    /**
     * 快捷入口
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class QuickLink {
        private Long id;
        private String name;
        private String icon;
        private String path;
        private Integer sortOrder;
    }
}
