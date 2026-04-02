package com.koduck.dto.community;
import java.math.BigDecimal;
import java.util.List;

import com.koduck.util.CollectionCopyUtils;

import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 *  DTO
 */
@Data
@NoArgsConstructor
public class UpdateSignalRequest {

    @Size(max = 2000, message = "推荐理由最多 2000 个字符")
    private String reason;

    @DecimalMin(value = "0.0001", message = "目标价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "目标价格格式不正确")
    private BigDecimal targetPrice;

    @DecimalMin(value = "0.0001", message = "止损价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "止损价格格式不正确")
    private BigDecimal stopLoss;

    @Min(value = 0, message = "信心指数最小为 0")
    @Max(value = 100, message = "信心指数最大为 100")
    private Integer confidence;

    @Pattern(regexp = "ACTIVE|CLOSED|CANCELLED", message = "状态必须是 ACTIVE, CLOSED 或 CANCELLED")
    private String status;

    private List<String> tags;

    public UpdateSignalRequest(String reason, BigDecimal targetPrice, BigDecimal stopLoss, Integer confidence,
                               String status, List<String> tags) {
        this.reason = reason;
        this.targetPrice = targetPrice;
        this.stopLoss = stopLoss;
        this.confidence = confidence;
        this.status = status;
        this.tags = CollectionCopyUtils.copyList(tags);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {

        private String reason;
        private BigDecimal targetPrice;
        private BigDecimal stopLoss;
        private Integer confidence;
        private String status;
        private List<String> tags;

        public Builder reason(String reason) { this.reason = reason; return this; }
        public Builder targetPrice(BigDecimal targetPrice) { this.targetPrice = targetPrice; return this; }
        public Builder stopLoss(BigDecimal stopLoss) { this.stopLoss = stopLoss; return this; }
        public Builder confidence(Integer confidence) { this.confidence = confidence; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder tags(List<String> tags) { this.tags = CollectionCopyUtils.copyList(tags); return this; }

        public UpdateSignalRequest build() {
            return new UpdateSignalRequest(reason, targetPrice, stopLoss, confidence, status, tags);
        }
    }

    public List<String> getTags() {
        return CollectionCopyUtils.copyList(tags);
    }

    public void setTags(List<String> tags) {
        this.tags = CollectionCopyUtils.copyList(tags);
    }
}
