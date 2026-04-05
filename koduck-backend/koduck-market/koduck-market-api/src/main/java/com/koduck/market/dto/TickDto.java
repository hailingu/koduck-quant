package com.koduck.market.dto;

/**
 * Tick event payload for tick history and stream APIs.
 *
 * @author Koduck Team
 * @param time the time string
 * @param price 价格
 * @param size the size
 * @param amount 成交额
 * @param type 类型
 * @param flag the flag
 * @param epochMillis the epoch milliseconds
 */
public record TickDto(
    String time,
    double price,
    int size,
    double amount,
    String type,
    String flag,
    Long epochMillis
) {}
