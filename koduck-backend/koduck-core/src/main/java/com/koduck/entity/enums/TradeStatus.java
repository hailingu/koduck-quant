package com.koduck.entity.enums;

/**
 * 交易状态枚举。
 * 从 Trade.TradeStatus 中提取以消除内部枚举冗余。
 *
 * @author Koduck Team
 */
public enum TradeStatus {

    /** 待处理状态。 */
    PENDING,

    /** 成功状态。 */
    SUCCESS,

    /** 失败状态。 */
    FAILED,

    /** 已取消状态。 */
    CANCELLED
}
