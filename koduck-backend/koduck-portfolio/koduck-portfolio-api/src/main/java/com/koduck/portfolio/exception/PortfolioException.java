package com.koduck.portfolio.exception;

/**
 * 投资组合领域异常。
 *
 * <p>表示投资组合相关的业务异常，如持仓不存在、权限不足等。</p>
 *
 * @author Koduck Team
 */
public class PortfolioException extends RuntimeException {

    /** Serial version UID. */
    private static final long serialVersionUID = 1L;

    /** 相关投资组合ID。 */
    private final Long portfolioId;

    /** 相关持仓ID。 */
    private final Long positionId;

    /**
     * 构造异常。
     *
     * @param message 异常消息
     */
    public PortfolioException(String message) {
        super(message);
        this.portfolioId = null;
        this.positionId = null;
    }

    /**
     * 构造异常。
     *
     * @param message     异常消息
     * @param portfolioId 相关投资组合ID
     */
    public PortfolioException(String message, Long portfolioId) {
        super(message);
        this.portfolioId = portfolioId;
        this.positionId = null;
    }

    /**
     * 构造异常。
     *
     * @param message     异常消息
     * @param portfolioId 相关投资组合ID
     * @param positionId  相关持仓ID
     */
    public PortfolioException(String message, Long portfolioId, Long positionId) {
        super(message);
        this.portfolioId = portfolioId;
        this.positionId = positionId;
    }

    /**
     * 构造异常。
     *
     * @param message 异常消息
     * @param cause   原始异常
     */
    public PortfolioException(String message, Throwable cause) {
        super(message, cause);
        this.portfolioId = null;
        this.positionId = null;
    }

    /**
     * 获取相关投资组合ID。
     *
     * @return 投资组合ID，可能为 null
     */
    public Long getPortfolioId() {
        return portfolioId;
    }

    /**
     * 获取相关持仓ID。
     *
     * @return 持仓ID，可能为 null
     */
    public Long getPositionId() {
        return positionId;
    }
}
