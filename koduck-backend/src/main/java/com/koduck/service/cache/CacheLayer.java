package com.koduck.service.cache;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * 底层键/值和集合操作的统一缓存抽象。
 *
 * @author GitHub Copilot
 */
public interface CacheLayer {

    void setValue(String key, Object value, long ttlSeconds);

    Object getValue(String key);

    void delete(String key);

    boolean hasKey(String key);

    void addSetMember(String key, Object member);

    void removeSetMember(String key, Object member);

    Set<Object> getSetMembers(String key);

    void replaceSet(String key, Collection<?> members);

    void replaceList(String key, Collection<?> values, long ttlSeconds);

    List<Object> getListRange(String key, long start, long end);
}
