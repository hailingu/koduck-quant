package com.koduck.dto.community;

import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.fasterxml.jackson.annotation.JsonProperty;

import com.koduck.util.CollectionCopyUtils;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Create signal request DTO.
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class CreateSignalRequest {

    /** The strategy ID. */
    @NotNull(message = "策略 ID 不能为空")
    private Long strategyId;

    /** The stock symbol. */
    @NotBlank(message = "股票代码不能为空")
    @Size(max = 20, message = "股票代码最多 20 个字符")
    private String symbol;

    /** The signal type (BUY, SELL, or HOLD). */
    @NotBlank(message = "信号类型不能为空")
    @Pattern(regexp = "BUY|SELL|HOLD", message = "信号类型必须是 BUY, SELL 或 HOLD")
    private String signalType;

    /** The recommendation reason. */
    @NotBlank(message = "推荐理由不能为空")
    @Size(max = 2000, message = "推荐理由最多 2000 个字符")
    private String reason;

    /** The target price. */
    @DecimalMin(value = "0.0001", message = "目标价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "目标价格格式不正确")
    private BigDecimal targetPrice;

    /** The stop loss price. */
    @DecimalMin(value = "0.0001", message = "止损价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "止损价格格式不正确")
    private BigDecimal stopLoss;

    /** The signal time frame. */
    @Size(max = 20, message = "时间周期最多 20 个字符")
    @JsonProperty("timeFrame")
    private String signalTimeFrame;

    /** The confidence level (0-100). */
    @Min(value = 0, message = "信心指数最小为 0")
    @Max(value = 100, message = "信心指数最大为 100")
    private Integer confidence;

    /** The tags list. */
    private List<String> tags;

    /**
     * 创建新的 Builder 实例。
     *
     * @return 构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for CreateSignalRequest.
     */
    public static final class Builder {

        /** The request being built. */
        private final CreateSignalRequest request = new CreateSignalRequest();

        /**
         * Sets the strategy ID.
         *
         * @param strategyId the strategy ID
         * @return 构建器
         */
        public Builder strategyId(Long strategyId) {
            request.setStrategyId(strategyId);
            return this;
        }

        /**
         * 设置品种代码。
         *
         * @param symbol 品种代码
         * @return 构建器
         */
        public Builder symbol(String symbol) {
            request.setSymbol(symbol);
            return this;
        }

        /**
         * 设置信号类型。
         *
         * @param signalType 信号类型
         * @return 构建器
         */
        public Builder signalType(String signalType) {
            request.setSignalType(signalType);
            return this;
        }

        /**
         * Sets the reason.
         *
         * @param reason the reason
         * @return 构建器
         */
        public Builder reason(String reason) {
            request.setReason(reason);
            return this;
        }

        /**
         * Sets the target price.
         *
         * @param targetPrice the target price
         * @return 构建器
         */
        public Builder targetPrice(BigDecimal targetPrice) {
            request.setTargetPrice(targetPrice);
            return this;
        }

        /**
         * Sets the stop loss price.
         *
         * @param stopLoss 止损价 price
         * @return 构建器
         */
        public Builder stopLoss(BigDecimal stopLoss) {
            request.setStopLoss(stopLoss);
            return this;
        }

        /**
         * Sets the time frame.
         *
         * @param timeFrame the time frame
         * @return 构建器
         */
        public Builder timeFrame(String timeFrame) {
            request.setSignalTimeFrame(timeFrame);
            return this;
        }

        /**
         * Sets the confidence level.
         *
         * @param confidence the confidence level
         * @return 构建器
         */
        public Builder confidence(Integer confidence) {
            request.setConfidence(confidence);
            return this;
        }

        /**
         * Sets the tags.
         *
         * @param tags the tags
         * @return 构建器
         */
        public Builder tags(List<String> tags) {
            request.setTags(tags);
            return this;
        }

        /**
         * Builds the CreateSignalRequest.
         *
         * @return the CreateSignalRequest
         */
        public CreateSignalRequest build() {
            CreateSignalRequest built = new CreateSignalRequest();
            built.setStrategyId(request.getStrategyId());
            built.setSymbol(request.getSymbol());
            built.setSignalType(request.getSignalType());
            built.setReason(request.getReason());
            built.setTargetPrice(request.getTargetPrice());
            built.setStopLoss(request.getStopLoss());
            built.setSignalTimeFrame(request.getSignalTimeFrame());
            built.setConfidence(request.getConfidence());
            built.setTags(request.getTags());
            return built;
        }
    }

    /**
     * Gets the tags with defensive copy.
     *
     * @return the tags
     */
    public List<String> getTags() {
        return CollectionCopyUtils.copyList(tags);
    }

    /**
     * Sets the tags with defensive copy.
     *
     * @param tags the tags
     */
    public void setTags(List<String> tags) {
        this.tags = CollectionCopyUtils.copyList(tags);
    }
}
