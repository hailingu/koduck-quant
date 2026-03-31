package com.koduck.config;

import com.koduck.entity.User;
import java.time.LocalDateTime;

/**
 * 测试数据工厂
 * 提供统一的测试数据构造方法
 */
public class TestDataFactory {
    
    private static long idCounter = 1;
    
    // ========== Generic ==========
    
    public static long nextTestId() {
        return nextId();
    }
    
    public static String nextName(String prefix) {
        return prefix + nextId();
    }

    // ========== Entity ==========

    public static User createUser() {
        User user = new User();
        user.setId(nextId());
        user.setUsername("testuser" + user.getId());
        user.setEmail("test" + user.getId() + "@example.com");
        user.setPasswordHash("encoded_password_hash");
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return user;
    }

    public static User createUser(String username) {
        User user = createUser();
        user.setUsername(username);
        user.setEmail(username + "@example.com");
        return user;
    }
    
    // ========== Helper ==========
    
    private static synchronized long nextId() {
        return idCounter++;
    }
    
    /**
     * 重置 ID 计数器（每个测试方法开始时调用）
     */
    public static void resetIdCounter() {
        idCounter = 1;
    }
}
