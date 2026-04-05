package com.koduck.infrastructure.cache;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * 底层键/值和集合操作的统一缓存抽象。
 *
 * @author Koduck Team
 */
public interface CacheLayer {

    /**
     * 设置缓存值。
     *
     * @param key 缓存键
     * @param value 缓存值
     * @param ttlSeconds 过期时间（秒）
     */
    void setValue(String key, Object value, long ttlSeconds);

    /**
     * 获取缓存值。
     *
     * @param key 缓存键
     * @return 缓存值
     */
    Object getValue(String key);

    /**
     * 删除缓存。
     *
     * @param key 缓存键
     */
    void delete(String key);

    /**
     * 检查缓存是否存在。
     *
     * @param key 缓存键
     * @return 如果存在返回 true，否则返回 false
     */
    boolean hasKey(String key);

    /**
     * 添加集合成员。
     *
     * @param key 缓存键
     * @param member 成员
     */
    void addSetMember(String key, Object member);

    /**
     * 移除集合成员。
     *
     * @param key 缓存键
     * @param member 成员
     */
    void removeSetMember(String key, Object member);

    /**
     * 获取集合成员。
     *
     * @param key 缓存键
     * @return 成员集合
     */
    Set<Object> getSetMembers(String key);

    /**
     * 替换集合。
     *
     * @param key 缓存键
     * @param members 成员集合
     */
    void replaceSet(String key, Collection<?> members);

    /**
     * 替换列表。
     *
     * @param key 缓存键
     * @param values 值集合
     * @param ttlSeconds 过期时间（秒）
     */
    void replaceList(String key, Collection<?> values, long ttlSeconds);

    /**
     * 获取列表范围。
     *
     * @param key 缓存键
     * @param start 开始索引
     * @param end 结束索引
     * @return 值列表
     */
    List<Object> getListRange(String key, long start, long end);
}
