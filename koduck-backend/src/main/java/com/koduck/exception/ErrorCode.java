package com.koduck.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * 
 *
 * <p></p>
 *
 * @author Koduck Team
 */
@Getter
public enum ErrorCode {

    // ==========  ==========
    SUCCESS(0, "success", HttpStatus.OK),

    // ==========  (1000-1099) ==========
    UNKNOWN_ERROR(1000, "系统内部错误，请稍后重试", HttpStatus.INTERNAL_SERVER_ERROR),
    BAD_REQUEST(1001, "请求参数错误", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(1002, "未登录或登录已过期", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(1003, "权限不足", HttpStatus.FORBIDDEN),
    NOT_FOUND(1004, "请求的资源不存在", HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED(1005, "请求方法不支持", HttpStatus.METHOD_NOT_ALLOWED),
    REQUEST_TIMEOUT(1006, "请求超时", HttpStatus.REQUEST_TIMEOUT),
    TOO_MANY_REQUESTS(1007, "请求过于频繁，请稍后重试", HttpStatus.TOO_MANY_REQUESTS),

    // ==========  (2000-2999) ==========
    BUSINESS_ERROR(2000, "业务处理失败", HttpStatus.BAD_REQUEST),
    VALIDATION_ERROR(2001, "参数校验失败", HttpStatus.BAD_REQUEST),
    DUPLICATE_ERROR(2002, "数据重复", HttpStatus.CONFLICT),
    RESOURCE_NOT_FOUND(2003, "资源不存在", HttpStatus.NOT_FOUND),
    RESOURCE_CONFLICT(2004, "资源冲突", HttpStatus.CONFLICT),
    OPERATION_NOT_ALLOWED(2005, "操作不允许", HttpStatus.FORBIDDEN),
    INVALID_STATE(2006, "状态异常", HttpStatus.BAD_REQUEST),
    EXTERNAL_SERVICE_ERROR(2007, "外部服务调用失败", HttpStatus.BAD_GATEWAY),

    // ==========  (3000-3099) ==========
    AUTH_ERROR(3000, "认证失败", HttpStatus.UNAUTHORIZED),
    AUTH_INVALID_CREDENTIALS(3001, "用户名或密码错误", HttpStatus.UNAUTHORIZED),
    AUTH_TOKEN_EXPIRED(3002, "登录已过期，请重新登录", HttpStatus.UNAUTHORIZED),
    AUTH_TOKEN_INVALID(3003, "无效的令牌", HttpStatus.UNAUTHORIZED),
    AUTH_ACCESS_DENIED(3004, "访问被拒绝", HttpStatus.FORBIDDEN),
    AUTH_ACCOUNT_DISABLED(3005, "账号已被禁用", HttpStatus.FORBIDDEN),
    AUTH_ACCOUNT_LOCKED(3006, "账号已被锁定", HttpStatus.FORBIDDEN),
    AUTH_PASSWORD_MISMATCH(3007, "密码不匹配", HttpStatus.BAD_REQUEST),
    AUTH_PASSWORD_TOO_WEAK(3008, "密码强度不足", HttpStatus.BAD_REQUEST),

    // ==========  (3100-3199) ==========
    USER_NOT_FOUND(3100, "用户不存在", HttpStatus.NOT_FOUND),
    USER_ALREADY_EXISTS(3101, "用户已存在", HttpStatus.CONFLICT),
    USER_EMAIL_EXISTS(3102, "邮箱已被注册", HttpStatus.CONFLICT),
    USER_USERNAME_EXISTS(3103, "用户名已被使用", HttpStatus.CONFLICT),
    USER_CANNOT_DELETE_SELF(3104, "不能删除自己", HttpStatus.BAD_REQUEST),
    USER_OLD_PASSWORD_INCORRECT(3105, "旧密码错误", HttpStatus.BAD_REQUEST),
    USER_RESERVED_USERNAME(3106, "该用户名为系统保留账号", HttpStatus.BAD_REQUEST),

    // ==========  (3200-3299) ==========
    CREDENTIAL_NOT_FOUND(3200, "凭证不存在", HttpStatus.NOT_FOUND),
    CREDENTIAL_NAME_EXISTS(3201, "凭证名称已存在", HttpStatus.CONFLICT),
    CREDENTIAL_INVALID(3202, "凭证无效", HttpStatus.BAD_REQUEST),
    CREDENTIAL_VERIFICATION_FAILED(3203, "凭证验证失败", HttpStatus.BAD_REQUEST),

    // ==========  (3300-3399) ==========
    PORTFOLIO_NOT_FOUND(3300, "持仓不存在", HttpStatus.NOT_FOUND),
    PORTFOLIO_INVALID_QUANTITY(3301, "无效的持仓数量", HttpStatus.BAD_REQUEST),
    PORTFOLIO_INVALID_PRICE(3302, "无效的价格", HttpStatus.BAD_REQUEST),

    // ==========  (3400-3499) ==========
    STRATEGY_NOT_FOUND(3400, "策略不存在", HttpStatus.NOT_FOUND),
    STRATEGY_NAME_EXISTS(3401, "策略名称已存在", HttpStatus.CONFLICT),
    STRATEGY_INVALID_PARAMS(3402, "策略参数无效", HttpStatus.BAD_REQUEST),

    // ==========  (3500-3599) ==========
    BACKTEST_NOT_FOUND(3500, "回测记录不存在", HttpStatus.NOT_FOUND),
    BACKTEST_INVALID_PARAMS(3501, "回测参数无效", HttpStatus.BAD_REQUEST),
    BACKTEST_INSUFFICIENT_DATA(3502, "数据不足，无法进行回测", HttpStatus.BAD_REQUEST),

    // ==========  (3600-3699) ==========
    MARKET_DATA_NOT_FOUND(3600, "市场数据不存在", HttpStatus.NOT_FOUND),
    MARKET_DATA_PROVIDER_ERROR(3601, "数据提供商错误", HttpStatus.BAD_GATEWAY),
    MARKET_SYMBOL_NOT_FOUND(3602, "股票代码不存在", HttpStatus.NOT_FOUND),

    // ==========  (3700-3799) ==========
    SIGNAL_NOT_FOUND(3700, "信号不存在", HttpStatus.NOT_FOUND),
    SIGNAL_ALREADY_LIKED(3701, "已经点赞过了", HttpStatus.CONFLICT),
    SIGNAL_NOT_LIKED(3702, "尚未点赞", HttpStatus.BAD_REQUEST),
    SIGNAL_ALREADY_SUBSCRIBED(3703, "已经订阅过了", HttpStatus.CONFLICT),
    SIGNAL_NOT_SUBSCRIBED(3704, "尚未订阅", HttpStatus.BAD_REQUEST),
    COMMENT_NOT_FOUND(3705, "评论不存在", HttpStatus.NOT_FOUND),

    // ========== AI  (3800-3899) ==========
    AI_ANALYSIS_ERROR(3800, "AI 分析失败", HttpStatus.BAD_GATEWAY),
    AI_RATE_LIMIT_EXCEEDED(3801, "AI 调用次数超限，请稍后重试", HttpStatus.TOO_MANY_REQUESTS),

    // ==========  (3900-3999) ==========
    DATA_SERVICE_ERROR(3900, "数据服务错误", HttpStatus.BAD_GATEWAY),
    DATA_SYNC_ERROR(3901, "数据同步失败", HttpStatus.INTERNAL_SERVER_ERROR);

    private final int code;
    private final String defaultMessage;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String defaultMessage, HttpStatus httpStatus) {
        this.code = code;
        this.defaultMessage = defaultMessage;
        this.httpStatus = httpStatus;
    }

    /**
     * 
     *
     * @param code 
     * @return  ErrorCode， UNKNOWN_ERROR
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
