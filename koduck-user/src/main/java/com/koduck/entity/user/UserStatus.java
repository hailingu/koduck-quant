package com.koduck.entity.user;

/**
 * 用户状态枚举。
 *
 * <p>与数据库 {@code users.status SMALLINT} 对齐，使用 ORDINAL 映射：
 * DISABLED=0, ACTIVE=1, PENDING=2。</p>
 *
 * <p><b>注意</b>：枚举声明顺序不可变更，否则会导致数据库数据错乱。
 * 如需新增状态值，请追加到末尾。</p>
 */
public enum UserStatus {

    /** 已禁用 */
    DISABLED,

    /** 正常活跃 */
    ACTIVE,

    /** 待激活（如注册后未验证邮箱） */
    PENDING
}
