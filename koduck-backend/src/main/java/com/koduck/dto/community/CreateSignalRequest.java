package com.koduck.dto.community;

import com.koduck.util.CollectionCopyUtils;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
public class CreateSignalRequest {

    @NotNull(message = "策略 ID 不能为空")
    private Long strategyId;

    @NotBlank(message = "股票代码不能为空")
    @Size(max = 20, message = "股票代码最多 20 个字符")
    private String symbol;

    @NotBlank(message = "信号类型不能为空")
    @Pattern(regexp = "BUY|SELL|HOLD", message = "信号类型必须是 BUY, SELL 或 HOLD")
    private String signalType;

    @NotBlank(message = "推荐理由不能为空")
    @Size(max = 2000, message = "推荐理由最多 2000 个字符")
    private String reason;

    @DecimalMin(value = "0.0001", message = "目标价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "目标价格格式不正确")
    private BigDecimal targetPrice;

    @DecimalMin(value = "0.0001", message = "止损价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "止损价格格式不正确")
    private BigDecimal stopLoss;

    @Size(max = 20, message = "时间周期最多 20 个字符")
    private String timeFrame;

    @Min(value = 0, message = "信心指数最小为 0")
    @Max(value = 100, message = "信心指数最大为 100")
    private Integer confidence;

    private List<String> tags;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private Long strategyId;
        private String symbol;
        private String signalType;
        private String reason;
        private BigDecimal targetPrice;
        private BigDecimal stopLoss;
        private String timeFrame;
        private Integer confidence;
        private List<String> tags;

        public Builder strategyId(Long strategyId) { this.strategyId = strategyId; return this; }
        public Builder symbol(String symbol) { this.symbol = symbol; return this; }
        public Builder signalType(String signalType) { this.signalType = signalType; return this; }
        public Builder reason(String reason) { this.reason = reason; return this; }
        public Builder targetPrice(BigDecimal targetPrice) { this.targetPrice = targetPrice; return this; }
        public Builder stopLoss(BigDecimal stopLoss) { this.stopLoss = stopLoss; return this; }
        public Builder timeFrame(String timeFrame) { this.timeFrame = timeFrame; return this; }
        public Builder confidence(Integer confidence) { this.confidence = confidence; return this; }
        public Builder tags(List<String> tags) { this.tags = CollectionCopyUtils.copyList(tags); return this; }

        public CreateSignalRequest build() {
            CreateSignalRequest request = new CreateSignalRequest();
            request.setStrategyId(strategyId);
            request.setSymbol(symbol);
            request.setSignalType(signalType);
            request.setReason(reason);
            request.setTargetPrice(targetPrice);
            request.setStopLoss(stopLoss);
            request.setTimeFrame(timeFrame);
            request.setConfidence(confidence);
            request.setTags(tags);
            return request;
        }
    }

    public List<String> getTags() {
        return CollectionCopyUtils.copyList(tags);
    }

    public void setTags(List<String> tags) {
        this.tags = CollectionCopyUtils.copyList(tags);
    }
}
