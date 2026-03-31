package com.koduck.dto.market;

/**
 * Tick event payload for tick history and stream APIs.
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
