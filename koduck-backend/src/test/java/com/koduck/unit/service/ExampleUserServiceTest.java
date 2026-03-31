package com.koduck.unit.service;

import com.koduck.config.TestDataFactory;
import com.koduck.entity.User;
import com.koduck.exception.UserNotFoundException;
import com.koduck.repository.UserRepository;
import com.koduck.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

/**
 * Service 层单元测试示例
 * 
 * 特点：
 * - 纯 Java 测试，无 Spring 上下文
 * - 使用 Mockito 模拟依赖
 * - 快速执行（毫秒级）
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("用户服务单元测试")
class ExampleUserServiceTest {
    
    @Mock
    private UserRepository userRepository;
    
    @InjectMocks
    private UserServiceImpl userService;
    
    @BeforeEach
    void setUp() {
        TestDataFactory.resetIdCounter();
    }
    
    @Test
    @DisplayName("根据ID查询用户 - 用户存在时应返回用户")
    void findById_WhenUserExists_ShouldReturnUser() {
        // Given
        User expectedUser = TestDataFactory.createUser();
        given(userRepository.findById(expectedUser.getId()))
            .willReturn(Optional.of(expectedUser));
        
        // When
        User actualUser = userService.findById(expectedUser.getId());
        
        // Then
        assertThat(actualUser)
            .isNotNull()
            .extracting(User::getId, User::getUsername)
            .containsExactly(expectedUser.getId(), expectedUser.getUsername());
        verify(userRepository).findById(expectedUser.getId());
    }
    
    @Test
    @DisplayName("根据ID查询用户 - 用户不存在时应抛出异常")
    void findById_WhenUserNotExists_ShouldThrowException() {
        // Given
        Long nonExistentId = 999L;
        given(userRepository.findById(nonExistentId))
            .willReturn(Optional.empty());
        
        // When & Then
        assertThatThrownBy(() -> userService.findById(nonExistentId))
            .isInstanceOf(UserNotFoundException.class)
            .hasMessageContaining(String.valueOf(nonExistentId));
    }
    
    @Test
    @DisplayName("创建用户 - 应保存并返回用户")
    void createUser_ShouldSaveAndReturnUser() {
        // Given
        User newUser = TestDataFactory.createUser();
        given(userRepository.existsByUsername(newUser.getUsername()))
            .willReturn(false);
        given(userRepository.save(any(User.class)))
            .willReturn(newUser);
        
        // When
        User savedUser = userService.createUser(newUser);
        
        // Then
        assertThat(savedUser)
            .isNotNull()
            .extracting(User::getUsername)
            .isEqualTo(newUser.getUsername());
        verify(userRepository).save(any(User.class));
    }
}
