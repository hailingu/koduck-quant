package com.koduck.exception;
import org.springframework.http.HttpStatus;

import lombok.Getter;

/**
 * Error codes for the application.
 *
 * <p>Defines all error codes with their default messages and HTTP status codes.</p>
 *
 * @author Koduck Team
 */
@Getter
public enum ErrorCode {

    // ========== General (0) ==========
    /**
     * Success response.
     */
    SUCCESS(0, "success", HttpStatus.OK),

    // ========== System (1000-1099) ==========
    /**
     * Unknown internal error.
     */
    UNKNOWN_ERROR(1000, "系统内部错误，请稍后重试", HttpStatus.INTERNAL_SERVER_ERROR),

    /**
     * Bad request parameters.
     */
    BAD_REQUEST(1001, "请求参数错误", HttpStatus.BAD_REQUEST),

    /**
     * Unauthorized access.
     */
    UNAUTHORIZED(1002, "未登录或登录已过期", HttpStatus.UNAUTHORIZED),

    /**
     * Forbidden access.
     */
    FORBIDDEN(1003, "权限不足", HttpStatus.FORBIDDEN),

    /**
     * Resource not found.
     */
    NOT_FOUND(1004, "请求的资源不存在", HttpStatus.NOT_FOUND),

    /**
     * Method not allowed.
     */
    METHOD_NOT_ALLOWED(1005, "请求方法不支持", HttpStatus.METHOD_NOT_ALLOWED),

    /**
     * Request timeout.
     */
    REQUEST_TIMEOUT(1006, "请求超时", HttpStatus.REQUEST_TIMEOUT),

    /**
     * Too many requests.
     */
    TOO_MANY_REQUESTS(1007, "请求过于频繁，请稍后重试", HttpStatus.TOO_MANY_REQUESTS),

    // ========== Business (2000-2999) ==========
    /**
     * Business processing error.
     */
    BUSINESS_ERROR(2000, "业务处理失败", HttpStatus.BAD_REQUEST),

    /**
     * Parameter validation error.
     */
    VALIDATION_ERROR(2001, "参数校验失败", HttpStatus.BAD_REQUEST),

    /**
     * Duplicate data error.
     */
    DUPLICATE_ERROR(2002, "数据重复", HttpStatus.CONFLICT),

    /**
     * Resource not found.
     */
    RESOURCE_NOT_FOUND(2003, "资源不存在", HttpStatus.NOT_FOUND),

    /**
     * Resource conflict.
     */
    RESOURCE_CONFLICT(2004, "资源冲突", HttpStatus.CONFLICT),

    /**
     * Operation not allowed.
     */
    OPERATION_NOT_ALLOWED(2005, "操作不允许", HttpStatus.FORBIDDEN),

    /**
     * Invalid state.
     */
    INVALID_STATE(2006, "状态异常", HttpStatus.BAD_REQUEST),

    /**
     * External service call failed.
     */
    EXTERNAL_SERVICE_ERROR(2007, "外部服务调用失败", HttpStatus.BAD_GATEWAY),

    // ========== Authentication (3000-3099) ==========
    /**
     * Authentication error.
     */
    AUTH_ERROR(3000, "认证失败", HttpStatus.UNAUTHORIZED),

    /**
     * Invalid credentials.
     */
    AUTH_INVALID_CREDENTIALS(3001, "用户名或密码错误", HttpStatus.UNAUTHORIZED),

    /**
     * Token expired.
     */
    AUTH_TOKEN_EXPIRED(3002, "登录已过期，请重新登录", HttpStatus.UNAUTHORIZED),

    /**
     * Invalid token.
     */
    AUTH_TOKEN_INVALID(3003, "无效的令牌", HttpStatus.UNAUTHORIZED),

    /**
     * Access denied.
     */
    AUTH_ACCESS_DENIED(3004, "访问被拒绝", HttpStatus.FORBIDDEN),

    /**
     * Account disabled.
     */
    AUTH_ACCOUNT_DISABLED(3005, "账号已被禁用", HttpStatus.FORBIDDEN),

    /**
     * Account locked.
     */
    AUTH_ACCOUNT_LOCKED(3006, "账号已被锁定", HttpStatus.FORBIDDEN),

    /**
     * Password mismatch.
     */
    AUTH_PASSWORD_MISMATCH(3007, "密码不匹配", HttpStatus.BAD_REQUEST),

    /**
     * Password too weak.
     */
    AUTH_PASSWORD_TOO_WEAK(3008, "密码强度不足", HttpStatus.BAD_REQUEST),

    // ========== User (3100-3199) ==========
    /**
     * User not found.
     */
    USER_NOT_FOUND(3100, "用户不存在", HttpStatus.NOT_FOUND),

    /**
     * User already exists.
     */
    USER_ALREADY_EXISTS(3101, "用户已存在", HttpStatus.CONFLICT),

    /**
     * Email already registered.
     */
    USER_EMAIL_EXISTS(3102, "邮箱已被注册", HttpStatus.CONFLICT),

    /**
     * Username already taken.
     */
    USER_USERNAME_EXISTS(3103, "用户名已被使用", HttpStatus.CONFLICT),

    /**
     * Cannot delete self.
     */
    USER_CANNOT_DELETE_SELF(3104, "不能删除自己", HttpStatus.BAD_REQUEST),

    /**
     * Old password incorrect.
     */
    USER_OLD_PASSWORD_INCORRECT(3105, "旧密码错误", HttpStatus.BAD_REQUEST),

    /**
     * Reserved username.
     */
    USER_RESERVED_USERNAME(3106, "该用户名为系统保留账号", HttpStatus.BAD_REQUEST),

    // ========== Credentials (3200-3299) ==========
    /**
     * Credential not found.
     */
    CREDENTIAL_NOT_FOUND(3200, "凭证不存在", HttpStatus.NOT_FOUND),

    /**
     * Credential name exists.
     */
    CREDENTIAL_NAME_EXISTS(3201, "凭证名称已存在", HttpStatus.CONFLICT),

    /**
     * Credential invalid.
     */
    CREDENTIAL_INVALID(3202, "凭证无效", HttpStatus.BAD_REQUEST),

    /**
     * Credential verification failed.
     */
    CREDENTIAL_VERIFICATION_FAILED(3203, "凭证验证失败", HttpStatus.BAD_REQUEST),

    // ========== Portfolio (3300-3399) ==========
    /**
     * Portfolio not found.
     */
    PORTFOLIO_NOT_FOUND(3300, "持仓不存在", HttpStatus.NOT_FOUND),

    /**
     * Invalid portfolio quantity.
     */
    PORTFOLIO_INVALID_QUANTITY(3301, "无效的持仓数量", HttpStatus.BAD_REQUEST),

    /**
     * Invalid price.
     */
    PORTFOLIO_INVALID_PRICE(3302, "无效的价格", HttpStatus.BAD_REQUEST),

    // ========== Strategy (3400-3499) ==========
    /**
     * Strategy not found.
     */
    STRATEGY_NOT_FOUND(3400, "策略不存在", HttpStatus.NOT_FOUND),

    /**
     * Strategy name exists.
     */
    STRATEGY_NAME_EXISTS(3401, "策略名称已存在", HttpStatus.CONFLICT),

    /**
     * Invalid strategy parameters.
     */
    STRATEGY_INVALID_PARAMS(3402, "策略参数无效", HttpStatus.BAD_REQUEST),

    // ========== Backtest (3500-3599) ==========
    /**
     * Backtest not found.
     */
    BACKTEST_NOT_FOUND(3500, "回测记录不存在", HttpStatus.NOT_FOUND),

    /**
     * Invalid backtest parameters.
     */
    BACKTEST_INVALID_PARAMS(3501, "回测参数无效", HttpStatus.BAD_REQUEST),

    /**
     * Insufficient data for backtest.
     */
    BACKTEST_INSUFFICIENT_DATA(3502, "数据不足，无法进行回测", HttpStatus.BAD_REQUEST),

    // ========== Market Data (3600-3699) ==========
    /**
     * Market data not found.
     */
    MARKET_DATA_NOT_FOUND(3600, "市场数据不存在", HttpStatus.NOT_FOUND),

    /**
     * Market data provider error.
     */
    MARKET_DATA_PROVIDER_ERROR(3601, "数据提供商错误", HttpStatus.BAD_GATEWAY),

    /**
     * Market symbol not found.
     */
    MARKET_SYMBOL_NOT_FOUND(3602, "股票代码不存在", HttpStatus.NOT_FOUND),

    // ========== Signal (3700-3799) ==========
    /**
     * Signal not found.
     */
    SIGNAL_NOT_FOUND(3700, "信号不存在", HttpStatus.NOT_FOUND),

    /**
     * Signal already liked.
     */
    SIGNAL_ALREADY_LIKED(3701, "已经点赞过了", HttpStatus.CONFLICT),

    /**
     * Signal not liked.
     */
    SIGNAL_NOT_LIKED(3702, "尚未点赞", HttpStatus.BAD_REQUEST),

    /**
     * Signal already subscribed.
     */
    SIGNAL_ALREADY_SUBSCRIBED(3703, "已经订阅过了", HttpStatus.CONFLICT),

    /**
     * Signal not subscribed.
     */
    SIGNAL_NOT_SUBSCRIBED(3704, "尚未订阅", HttpStatus.BAD_REQUEST),

    /**
     * Comment not found.
     */
    COMMENT_NOT_FOUND(3705, "评论不存在", HttpStatus.NOT_FOUND),

    // ========== AI (3800-3899) ==========
    /**
     * AI analysis error.
     */
    AI_ANALYSIS_ERROR(3800, "AI 分析失败", HttpStatus.BAD_GATEWAY),

    /**
     * AI rate limit exceeded.
     */
    AI_RATE_LIMIT_EXCEEDED(3801, "AI 调用次数超限，请稍后重试", HttpStatus.TOO_MANY_REQUESTS),

    // ========== Data Service (3900-3999) ==========
    /**
     * Data service error.
     */
    DATA_SERVICE_ERROR(3900, "数据服务错误", HttpStatus.BAD_GATEWAY),

    /**
     * Data sync error.
     */
    DATA_SYNC_ERROR(3901, "数据同步失败", HttpStatus.INTERNAL_SERVER_ERROR);

    /**
     * The error code.
     */
    private final int code;

    /**
     * The default error message.
     */
    private final String defaultMessage;

    /**
     * The HTTP status code.
     */
    private final HttpStatus httpStatus;

    /**
     * Constructs a new ErrorCode.
     *
     * @param code the error code
     * @param defaultMessage the default message
     * @param httpStatus the HTTP status
     */
    ErrorCode(int code, String defaultMessage, HttpStatus httpStatus) {
        this.code = code;
        this.defaultMessage = defaultMessage;
        this.httpStatus = httpStatus;
    }

    /**
     * Get ErrorCode by code value.
     *
     * @param code the error code value
     * @return the matching ErrorCode, or UNKNOWN_ERROR if not found
     */
    public static ErrorCode fromCode(int code) {
        for (ErrorCode errorCode : values()) {
            if (errorCode.code == code) {
                return errorCode;
            }
        }
        return UNKNOWN_ERROR;
    }
}
