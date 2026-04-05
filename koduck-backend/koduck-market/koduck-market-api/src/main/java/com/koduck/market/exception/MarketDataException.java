package com.koduck.market.exception;

/**
 * 行情数据领域异常。
 *
 * <p>表示行情数据相关的业务异常，如数据不存在、格式错误等。</p>
 *
 * @author Koduck Team
 */
public class MarketDataException extends RuntimeException {

    /** Serial version UID. */
    private static final long serialVersionUID = 1L;

    /** 相关股票代码。 */
    private final String symbol;

    /**
     * 构造异常。
     *
     * @param message 异常消息
     */
    public MarketDataException(String message) {
        super(message);
        this.symbol = null;
    }

    /**
     * 构造异常。
     *
     * @param message 异常消息
     * @param symbol  相关股票代码
     */
    public MarketDataException(String message, String symbol) {
        super(message);
        this.symbol = symbol;
    }

    /**
     * 构造异常。
     *
     * @param message 异常消息
     * @param cause   原始异常
     */
    public MarketDataException(String message, Throwable cause) {
        super(message, cause);
        this.symbol = null;
    }

    /**
     * 获取相关股票代码。
     *
     * @return 股票代码，可能为 null
     */
    public String getSymbol() {
        return symbol;
    }
}
