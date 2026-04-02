package com.koduck.config;
import java.time.LocalDateTime;

import com.koduck.entity.User;

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
        long id = nextId();
        return User.builder()
                .id(id)
                .username("testuser" + id)
                .email("test" + id + "@example.com")
                .passwordHash("encoded_password_hash")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
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
