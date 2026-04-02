package com.koduck.dto;

import java.time.Instant;
import java.util.Objects;

import org.slf4j.MDC;

import com.koduck.exception.ErrorCode;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统一 API 响应包装类
 *
 * <p>所有 API 响应都使用此类进行包装，确保响应格式统一。</p>
 *
 * @param <T> 响应数据类型
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "统一API响应结构")
public class ApiResponse<T> {

    /**
     * Trace ID key for MDC.
     */
    private static final String TRACE_ID_KEY = "traceId";

    /**
     * 响应码，0 表示成功.
     */
    @Schema(description = "响应码，0表示成功", example = "0")
    private int code;

    /**
     * 响应消息.
     */
    @Schema(description = "响应消息", example = "success")
    private String message;

    /**
     * 响应数据.
     */
    @Schema(description = "响应数据")
    private T data;

    /**
     * 响应时间戳.
     */
    @Schema(description = "响应时间戳(毫秒)", example = "1704067200000")
    private long timestamp;

    /**
     * 请求追踪 ID.
     */
    @Schema(description = "请求追踪ID", example = "abc123def456")
    private String traceId;

    /**
     * 完整构造函数.
     *
     * @param code    响应码
     * @param message 响应消息
     * @param data    响应数据
     */
    public ApiResponse(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.timestamp = Instant.now().toEpochMilli();
        this.traceId = getCurrentTraceId();
    }

    /**
     * 成功响应.
     *
     * @param data 响应数据
     * @param <T>  数据类型
     * @return 成功响应
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(),
                ErrorCode.SUCCESS.getDefaultMessage(), data);
    }

    /**
     * 成功响应（无数据）.
     *
     * @param <T> 数据类型
     * @return 成功响应
     */
    public static <T> ApiResponse<T> success() {
        return success(null);
    }

    /**
     * 成功响应（带消息）.
     *
     * @param message 成功消息
     * @param data    响应数据
     * @param <T>     数据类型
     * @return 成功响应
     */
    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), message, data);
    }

    /**
     * Returns a success response with message and no payload.
     *
     * @param message success message
     * @return success response without data
     */
    public static ApiResponse<Void> successMessage(String message) {
        return success(message, null);
    }

    /**
     * Returns a success response with no payload.
     *
     * @return success response without data
     */
    public static ApiResponse<Void> successNoContent() {
        return success();
    }

    /**
     * 错误响应.
     *
     * @param code    错误码
     * @param message 错误消息
     * @param <T>     数据类型
     * @return 错误响应
     */
    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    /**
     * 错误响应.
     *
     * @param errorCode 错误码枚举
     * @param <T>       数据类型
     * @return 错误响应
     */
    public static <T> ApiResponse<T> error(ErrorCode errorCode) {
        return new ApiResponse<>(errorCode.getCode(), errorCode.getDefaultMessage(), null);
    }

    /**
     * 错误响应.
     *
     * @param errorCode 错误码枚举
     * @param message   自定义错误消息
     * @param <T>       数据类型
     * @return 错误响应
     */
    public static <T> ApiResponse<T> error(ErrorCode errorCode, String message) {
        return new ApiResponse<>(errorCode.getCode(), message, null);
    }

    /**
     * 错误响应（默认业务错误）.
     *
     * @param message 错误消息
     * @param <T>     数据类型
     * @return 错误响应
     */
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(ErrorCode.BUSINESS_ERROR.getCode(), message, null);
    }

    /**
     * 判断是否成功.
     *
     * @return 是否成功
     */
    @Schema(hidden = true)
    public boolean isSuccess() {
        return code == ErrorCode.SUCCESS.getCode();
    }

    /**
     * 获取当前 Trace ID.
     *
     * @return Trace ID，如果不存在则返回 null
     */
    private static String getCurrentTraceId() {
        try {
            return MDC.get(TRACE_ID_KEY);
        }
        catch (Exception _) {
            return null;
        }
    }

    @Override
    public String toString() {
        return "ApiResponse{"
                + "code=" + code
                + ", message='" + message + '\''
                + ", timestamp=" + timestamp
                + ", traceId='" + traceId + '\''
                + '}';
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        ApiResponse<?> that = (ApiResponse<?>) o;
        return code == that.code
                && timestamp == that.timestamp
                && Objects.equals(message, that.message)
                && Objects.equals(data, that.data)
                && Objects.equals(traceId, that.traceId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(code, message, data, timestamp, traceId);
    }
}
