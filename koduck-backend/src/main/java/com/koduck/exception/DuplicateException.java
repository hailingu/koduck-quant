package com.koduck.exception;

import lombok.Getter;

/**
 * 数据重复异常。
 *
 * <p>用于表示试图创建或更新数据时发生重复冲突的情况。</p>
 *
 * @author Koduck Team
 */
@Getter
public class DuplicateException extends BusinessException {

    /**
     * 重复的字段名
     */
    private final String field;

    /**
     * 重复的值
     */
    private final Object value;

    /**
     * 创建重复异常。
     *
     * @param message 错误消息
     */
    public DuplicateException(String message) {
        super(ErrorCode.DUPLICATE_ERROR.getCode(), message);
        this.field = null;
        this.value = null;
    }

    /**
     * 创建重复异常。
     *
     * @param errorCode 错误码枚举
     */
    public DuplicateException(ErrorCode errorCode) {
        super(errorCode.getCode(), errorCode.getDefaultMessage());
        this.field = null;
        this.value = null;
    }

    /**
     * 创建重复异常。
     *
     * @param field   重复的字段名
     * @param value   重复的值
     * @param message 错误消息
     */
    public DuplicateException(String field, Object value, String message) {
        super(ErrorCode.DUPLICATE_ERROR.getCode(), message);
        this.field = field;
        this.value = value;
    }

    /**
     * 创建重复异常（使用默认消息）。
     *
     * @param field 重复的字段名
     * @param value 重复的值
     */
    public DuplicateException(String field, Object value) {
        this(field, value, field + " 已存在: " + value);
    }

    /**
     * 快速创建重复异常。
     *
     * @param field   字段名
     * @param value   值
     * @param message 消息
     * @return DuplicateException
     */
    public static DuplicateException of(String field, Object value, String message) {
        return new DuplicateException(field, value, message);
    }

    /**
     * 快速创建重复异常（使用默认消息）。
     *
     * @param field 字段名
     * @param value 值
     * @return DuplicateException
     */
    public static DuplicateException of(String field, Object value) {
        return new DuplicateException(field, value);
    }
}
