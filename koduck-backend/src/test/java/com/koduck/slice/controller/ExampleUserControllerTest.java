package com.koduck.slice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.koduck.config.TestConfig;
import com.koduck.config.TestDataFactory;
import com.koduck.dto.user.UserDto;
import com.koduck.entity.User;
import com.koduck.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.hamcrest.Matchers.*;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller 层切片测试示例
 * 
 * 特点：
 * - 仅加载 Web 层，不加载完整 Spring 上下文
 * - 使用 @WebMvcTest 指定测试的 Controller
 * - 模拟 Service 层依赖
 * - 测试 HTTP 请求/响应，不依赖真实 HTTP 服务器
 */
@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)  // 禁用安全过滤器，专注测试业务逻辑
@Import(TestConfig.class)
@DisplayName("用户控制器切片测试")
class ExampleUserControllerTest {
    
    private static final String API_PATH = "/api/users";
    
    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @MockitoBean
    private UserService userService;
    
    @BeforeEach
    void setUp() {
        TestDataFactory.resetIdCounter();
    }
    
    @Test
    @DisplayName("GET /api/users/{id} - 应返回用户信息")
    void getUserById_ShouldReturnUser() throws Exception {
        // Given
        User user = TestDataFactory.createUser();
        given(userService.findById(user.getId())).willReturn(user);
        
        // When
        ResultActions result = mockMvc.perform(get(API_PATH + "/{id}", user.getId())
            .accept(MediaType.APPLICATION_JSON));
        
        // Then
        result.andExpect(status().isOk())
              .andExpect(content().contentType(MediaType.APPLICATION_JSON))
              .andExpect(jsonPath("$.id").value(user.getId()))
              .andExpect(jsonPath("$.username").value(user.getUsername()))
              .andExpect(jsonPath("$.email").value(user.getEmail()));
    }
    
    @Test
    @DisplayName("POST /api/users - 应创建用户并返回 201")
    void createUser_ShouldReturnCreated() throws Exception {
        // Given
        UserDto requestDto = TestDataFactory.createUserDto();
        User createdUser = TestDataFactory.createUser();
        given(userService.createUser(org.mockito.ArgumentMatchers.any())).willReturn(createdUser);
        
        // When
        ResultActions result = mockMvc.perform(post(API_PATH)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(requestDto)));
        
        // Then
        result.andExpect(status().isCreated())
              .andExpect(header().exists("Location"))
              .andExpect(jsonPath("$.id").exists());
    }
    
    @Test
    @DisplayName("GET /api/users/{id} - 用户不存在时应返回 404")
    void getUserById_WhenNotFound_ShouldReturn404() throws Exception {
        // Given
        Long nonExistentId = 999L;
        given(userService.findById(nonExistentId))
            .willThrow(new com.koduck.exception.UserNotFoundException(nonExistentId));
        
        // When
        ResultActions result = mockMvc.perform(get(API_PATH + "/{id}", nonExistentId));
        
        // Then
        result.andExpect(status().isNotFound());
    }
}

// 简化的 UserController 用于测试编译
class UserController {
    private final UserService userService;
    
    public UserController(UserService userService) {
        this.userService = userService;
    }
}
