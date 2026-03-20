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
 * 
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

    // 
    @Column(name = "theme", nullable = false, length = 20)
    @Builder.Default
    private String theme = "light";

    @Column(name = "language", nullable = false, length = 10)
    @Builder.Default
    private String language = "zh-CN";

    @Column(name = "timezone", nullable = false, length = 50)
    @Builder.Default
    private String timezone = "Asia/Shanghai";

    // 
    @Column(name = "notification_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private NotificationConfig notificationConfig = new NotificationConfig();

    // 
    @Column(name = "trading_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private TradingConfig tradingConfig = new TradingConfig();

    // 
    @Column(name = "display_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private DisplayConfig displayConfig = new DisplayConfig();

    // 
    @Column(name = "quick_links", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private List<QuickLink> quickLinks = List.of();

    // 
    @Column(name = "llm_config", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    @Builder.Default
    private LlmConfig llmConfig = new LlmConfig();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * 
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
     * 
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
     * 
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
     * 
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

    /**
     * 
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LlmConfig {
        private String provider;
        // legacy ，
        private String apiKey;
        private String apiBase;
        private ProviderConfig minimax;
        private ProviderConfig deepseek;
        private ProviderConfig openai;
        @Builder.Default
        private MemoryConfig memory = new MemoryConfig();
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProviderConfig {
        private String apiKey;
        private String apiBase;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MemoryConfig {
        @Builder.Default
        private Boolean enabled = true;
        @Builder.Default
        private String mode = "L0";
        @Builder.Default
        private Boolean enableL1 = true;
        @Builder.Default
        private Boolean enableL2 = true;
        @Builder.Default
        private Boolean enableL3 = true;
    }

}
