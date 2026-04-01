package com.koduck.dto.community;

import com.koduck.util.CollectionCopyUtils;
import com.fasterxml.jackson.annotation.JsonProperty;
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
    @JsonProperty("timeFrame")
    private String signalTimeFrame;

    @Min(value = 0, message = "信心指数最小为 0")
    @Max(value = 100, message = "信心指数最大为 100")
    private Integer confidence;

    private List<String> tags;

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private final CreateSignalRequest request = new CreateSignalRequest();

        public Builder strategyId(Long strategyId) { request.setStrategyId(strategyId); return this; }
        public Builder symbol(String symbol) { request.setSymbol(symbol); return this; }
        public Builder signalType(String signalType) { request.setSignalType(signalType); return this; }
        public Builder reason(String reason) { request.setReason(reason); return this; }
        public Builder targetPrice(BigDecimal targetPrice) { request.setTargetPrice(targetPrice); return this; }
        public Builder stopLoss(BigDecimal stopLoss) { request.setStopLoss(stopLoss); return this; }
        public Builder timeFrame(String timeFrame) { request.setSignalTimeFrame(timeFrame); return this; }
        public Builder confidence(Integer confidence) { request.setConfidence(confidence); return this; }
        public Builder tags(List<String> tags) { request.setTags(tags); return this; }

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

    public List<String> getTags() {
        return CollectionCopyUtils.copyList(tags);
    }

    public void setTags(List<String> tags) {
        this.tags = CollectionCopyUtils.copyList(tags);
    }
}
