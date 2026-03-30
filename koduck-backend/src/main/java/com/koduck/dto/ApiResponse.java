package com.koduck.dto;

import com.koduck.exception.ErrorCode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.slf4j.MDC;

import java.time.Instant;
import java.util.Objects;

/**
 *  API 
 *
 * <p> API ，</p>
 *
 * @param <T> 
 * @author Koduck Team
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {

    /**
     * Trace ID key for MDC
     */
    private static final String TRACE_ID_KEY = "traceId";

    /**
     * ，0 
     */
    private int code;

    /**
     * 
     */
    private String message;

    /**
     * 
     */
    private T data;

    /**
     * 
     */
    private long timestamp;

    /**
     *  ID
     */
    private String traceId;

    /**
     * 
     *
     * @param code    
     * @param message 
     * @param data    
     */
    public ApiResponse(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.timestamp = Instant.now().toEpochMilli();
        this.traceId = getCurrentTraceId();
    }

    /**
     * 
     *
     * @param data 
     * @param <T>  
     * @return 
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(ErrorCode.SUCCESS.getCode(), ErrorCode.SUCCESS.getDefaultMessage(), data);
    }

    /**
     * （）
     *
     * @param <T> 
     * @return 
     */
    public static <T> ApiResponse<T> success() {
        return success(null);
    }

    /**
     * （）
     *
     * @param message 
     * @param data    
     * @param <T>     
     * @return 
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
     * 
     *
     * @param code    
     * @param message 
     * @param <T>     
     * @return 
     */
    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    /**
     * 
     *
     * @param errorCode 
     * @param <T>       
     * @return 
     */
    public static <T> ApiResponse<T> error(ErrorCode errorCode) {
        return new ApiResponse<>(errorCode.getCode(), errorCode.getDefaultMessage(), null);
    }

    /**
     * 
     *
     * @param errorCode 
     * @param message   
     * @param <T>       
     * @return 
     */
    public static <T> ApiResponse<T> error(ErrorCode errorCode, String message) {
        return new ApiResponse<>(errorCode.getCode(), message, null);
    }

    /**
     * （）
     *
     * @param message 
     * @param <T>     
     * @return 
     */
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(ErrorCode.BUSINESS_ERROR.getCode(), message, null);
    }

    /**
     * 
     *
     * @return 
     */
    public boolean isSuccess() {
        return code == ErrorCode.SUCCESS.getCode();
    }

    /**
     *  Trace ID
     *
     * @return Trace ID  null
     */
    private static String getCurrentTraceId() {
        try {
            return MDC.get(TRACE_ID_KEY);
        } catch (Exception _) {
            return null;
        }
    }

    @Override
    public String toString() {
        return "ApiResponse{" +
                "code=" + code +
                ", message='" + message + '\'' +
                ", timestamp=" + timestamp +
                ", traceId='" + traceId + '\'' +
                '}';
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ApiResponse<?> that = (ApiResponse<?>) o;
        return code == that.code &&
                timestamp == that.timestamp &&
                Objects.equals(message, that.message) &&
                Objects.equals(data, that.data) &&
                Objects.equals(traceId, that.traceId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(code, message, data, timestamp, traceId);
    }
}
