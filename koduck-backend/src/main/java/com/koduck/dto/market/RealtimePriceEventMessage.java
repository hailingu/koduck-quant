package com.koduck.dto.market;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * RabbitMQ event payload for realtime stock quote updates.
 *
 * @author Koduck Team
 */
public class RealtimePriceEventMessage {

    /** The stock symbol. */
    private String symbol;

    /** The stock name. */
    private String name;

    /** The stock type. */
    private String type;

    /** The current price. */
    private BigDecimal price;

    /** The price change amount. */
    private BigDecimal changeAmount;

    /** The price change percentage. */
    private BigDecimal changePercent;

    /** The trading volume. */
    private Long volume;

    /** The trading amount. */
    private BigDecimal amount;

    /** The timestamp. */
    private Instant timestamp;

    /**
     * Get the symbol.
     *
     * @return the symbol
     */
    public String getSymbol() {
        return symbol;
    }

    /**
     * Set the symbol.
     *
     * @param symbol the symbol to set
     */
    public void setSymbol(String symbol) {
        this.symbol = symbol;
    }

    /**
     * Get the name.
     *
     * @return the name
     */
    public String getName() {
        return name;
    }

    /**
     * Set the name.
     *
     * @param name the name to set
     */
    public void setName(String name) {
        this.name = name;
    }

    /**
     * Get the type.
     *
     * @return the type
     */
    public String getType() {
        return type;
    }

    /**
     * Set the type.
     *
     * @param type the type to set
     */
    public void setType(String type) {
        this.type = type;
    }

    /**
     * Get the price.
     *
     * @return the price
     */
    public BigDecimal getPrice() {
        return price;
    }

    /**
     * Set the price.
     *
     * @param price the price to set
     */
    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    /**
     * Get the change amount.
     *
     * @return the change amount
     */
    public BigDecimal getChangeAmount() {
        return changeAmount;
    }

    /**
     * Set the change amount.
     *
     * @param changeAmount the change amount to set
     */
    public void setChangeAmount(BigDecimal changeAmount) {
        this.changeAmount = changeAmount;
    }

    /**
     * Get the change percent.
     *
     * @return the change percent
     */
    public BigDecimal getChangePercent() {
        return changePercent;
    }

    /**
     * Set the change percent.
     *
     * @param changePercent the change percent to set
     */
    public void setChangePercent(BigDecimal changePercent) {
        this.changePercent = changePercent;
    }

    /**
     * Get the volume.
     *
     * @return the volume
     */
    public Long getVolume() {
        return volume;
    }

    /**
     * Set the volume.
     *
     * @param volume the volume to set
     */
    public void setVolume(Long volume) {
        this.volume = volume;
    }

    /**
     * Get the amount.
     *
     * @return the amount
     */
    public BigDecimal getAmount() {
        return amount;
    }

    /**
     * Set the amount.
     *
     * @param amount the amount to set
     */
    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    /**
     * Get the timestamp.
     *
     * @return the timestamp
     */
    public Instant getTimestamp() {
        return timestamp;
    }

    /**
     * Set the timestamp.
     *
     * @param timestamp the timestamp to set
     */
    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
