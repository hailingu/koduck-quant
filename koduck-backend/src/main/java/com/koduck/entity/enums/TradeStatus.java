package com.koduck.entity.enums;

/**
 * Trade status enumeration.
 * Extracted from Trade.TradeStatus to eliminate inner enum redundancy.
 *
 * @author Koduck Team
 */
public enum TradeStatus {

    /** Pending status. */
    PENDING,

    /** Success status. */
    SUCCESS,

    /** Failed status. */
    FAILED,

    /** Cancelled status. */
    CANCELLED
}
