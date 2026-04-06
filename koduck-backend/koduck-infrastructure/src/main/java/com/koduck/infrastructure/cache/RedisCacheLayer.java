package com.koduck.infrastructure.cache;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

/**
 * {@link CacheLayer}的Redis实现。
 *
 * @author Koduck Team
 */
@Component
public class RedisCacheLayer implements CacheLayer {

    /**
     * 缓存操作的Redis模板。
     */
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * 构造函数。
     *
     * @param redisTemplate Redis模板
     */
    public RedisCacheLayer(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = Objects.requireNonNull(redisTemplate, "redisTemplate must not be null");
    }

    @Override
    public void setValue(String key, Object value, long ttlSeconds) {
        redisTemplate.opsForValue().set(
                Objects.requireNonNull(key, "key must not be null"),
                Objects.requireNonNull(value, "value must not be null"),
                ttlSeconds,
                TimeUnit.SECONDS
        );
    }

    @Override
    public Object getValue(String key) {
        return redisTemplate.opsForValue().get(Objects.requireNonNull(key, "key must not be null"));
    }

    @Override
    public void delete(String key) {
        redisTemplate.delete(Objects.requireNonNull(key, "key must not be null"));
    }

    @Override
    public boolean hasKey(String key) {
        Boolean exists = redisTemplate.hasKey(Objects.requireNonNull(key, "key must not be null"));
        return Boolean.TRUE.equals(exists);
    }

    @Override
    public void addSetMember(String key, Object member) {
        redisTemplate.opsForSet().add(
                Objects.requireNonNull(key, "key must not be null"),
                Objects.requireNonNull(member, "member must not be null")
        );
    }

    @Override
    public void removeSetMember(String key, Object member) {
        redisTemplate.opsForSet().remove(
                Objects.requireNonNull(key, "key must not be null"),
                Objects.requireNonNull(member, "member must not be null")
        );
    }

    @Override
    public Set<Object> getSetMembers(String key) {
        return redisTemplate.opsForSet().members(Objects.requireNonNull(key, "key must not be null"));
    }

    @Override
    public void replaceSet(String key, Collection<?> members) {
        String nonNullKey = Objects.requireNonNull(key, "key must not be null");
        redisTemplate.delete(nonNullKey);
        if (members == null || members.isEmpty()) {
            return;
        }
        for (Object member : members) {
            if (member != null) {
                redisTemplate.opsForSet().add(nonNullKey, member);
            }
        }
    }

    @Override
    public void replaceList(String key, Collection<?> values, long ttlSeconds) {
        String nonNullKey = Objects.requireNonNull(key, "key must not be null");
        redisTemplate.delete(nonNullKey);
        if (values == null || values.isEmpty()) {
            return;
        }
        Object[] valueArray = values.stream().filter(Objects::nonNull).toArray();
        if (valueArray.length == 0) {
            return;
        }
        redisTemplate.opsForList().rightPushAll(nonNullKey, valueArray);
        redisTemplate.expire(nonNullKey, ttlSeconds, TimeUnit.SECONDS);
    }

    @Override
    public List<Object> getListRange(String key, long start, long end) {
        return redisTemplate.opsForList().range(
                Objects.requireNonNull(key, "key must not be null"),
                start,
                end
        );
    }
}
