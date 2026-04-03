package com.koduck.dto.market;

/**
 * Tick event payload for tick history and stream APIs.
 *
 * @author Koduck Team
 * @param time the time string
 * @param price the price
 * @param size the size
 * @param amount the amount
 * @param type the type
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
