package com.koduck.config;

import com.koduck.dto.auth.RegisterRequest;
import com.koduck.dto.user.UserDto;
import com.koduck.entity.User;

import java.time.LocalDateTime;

/**
 * 测试数据工厂
 * 提供统一的测试数据构造方法
 */
public class TestDataFactory {
    
    private static long idCounter = 1;
    
    // ========== User ==========
    
    public static User createUser() {
        User user = new User();
        user.setId(nextId());
        user.setUsername("testuser" + user.getId());
        user.setEmail("test" + user.getId() + "@example.com");
        user.setPassword("encoded_password");
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
    
    // ========== DTO ==========
    
    public static UserDto createUserDto() {
        UserDto dto = new UserDto();
        dto.setId(nextId());
        dto.setUsername("testuser" + dto.getId());
        dto.setEmail("test" + dto.getId() + "@example.com");
        return dto;
    }
    
    public static RegisterRequest createRegisterRequest() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("newuser" + nextId());
        request.setEmail("new" + System.currentTimeMillis() + "@example.com");
        request.setPassword("Password123!");
        request.setConfirmPassword("Password123!");
        return request;
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
