package com.koduck.dto.community;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 *  DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalResponse {

    private Long id;
    private Long userId;
    private String username;
    private String avatarUrl;
    private Long strategyId;
    private String strategyName;

    private String symbol;
    private String signalType;
    private String reason;

    private BigDecimal targetPrice;
    private BigDecimal stopLoss;
    private String timeFrame;
    private Integer confidence;

    private String status;
    private String resultStatus;
    private BigDecimal resultProfit;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime expiresAt;

    private Integer likeCount;
    private Integer favoriteCount;
    private Integer subscribeCount;
    private Integer commentCount;
    private Integer viewCount;

    private Boolean isFeatured;
    private List<String> tags;

    // 
    private Boolean isLiked;
    private Boolean isFavorited;
    private Boolean isSubscribed;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
}
