package com.koduck.dto.community;

import java.math.BigDecimal;
import java.util.List;

import com.koduck.util.CollectionCopyUtils;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Update signal request DTO.
 *
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
public class UpdateSignalRequest {

    /** 推荐理由. */
    @Size(max = 2000, message = "推荐理由最多 2000 个字符")
    private String reason;

    /** 目标价格. */
    @DecimalMin(value = "0.0001", message = "目标价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "目标价格格式不正确")
    private BigDecimal targetPrice;

    /** 止损价格. */
    @DecimalMin(value = "0.0001", message = "止损价格必须大于 0")
    @Digits(integer = 15, fraction = 4, message = "止损价格格式不正确")
    private BigDecimal stopLoss;

    /** 信心指数. */
    @Min(value = 0, message = "信心指数最小为 0")
    @Max(value = 100, message = "信心指数最大为 100")
    private Integer confidence;

    /** 状态. */
    @Pattern(regexp = "ACTIVE|CLOSED|CANCELLED", message = "状态必须是 ACTIVE, CLOSED 或 CANCELLED")
    private String status;

    /** 标签列表. */
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

    /** Builder class for UpdateSignalRequest. */
    public static final class Builder {

        /** 推荐理由. */
        private String reason;

        /** 目标价格. */
        private BigDecimal targetPrice;

        /** 止损价格. */
        private BigDecimal stopLoss;

        /** 信心指数. */
        private Integer confidence;

        /** 状态. */
        private String status;

        /** 标签列表. */
        private List<String> tags;

        /**
         * Set reason.
         *
         * @param reason the reason
         * @return this builder
         */
        public Builder reason(String reason) {
            this.reason = reason;
            return this;
        }

        /**
         * Set target price.
         *
         * @param targetPrice the target price
         * @return this builder
         */
        public Builder targetPrice(BigDecimal targetPrice) {
            this.targetPrice = targetPrice;
            return this;
        }

        /**
         * Set stop loss.
         *
         * @param stopLoss the stop loss
         * @return this builder
         */
        public Builder stopLoss(BigDecimal stopLoss) {
            this.stopLoss = stopLoss;
            return this;
        }

        /**
         * Set confidence.
         *
         * @param confidence the confidence
         * @return this builder
         */
        public Builder confidence(Integer confidence) {
            this.confidence = confidence;
            return this;
        }

        /**
         * Set status.
         *
         * @param status the status
         * @return this builder
         */
        public Builder status(String status) {
            this.status = status;
            return this;
        }

        /**
         * Set tags.
         *
         * @param tags the tags
         * @return this builder
         */
        public Builder tags(List<String> tags) {
            this.tags = CollectionCopyUtils.copyList(tags);
            return this;
        }

        /**
         * Build the UpdateSignalRequest.
         *
         * @return the UpdateSignalRequest instance
         */
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
