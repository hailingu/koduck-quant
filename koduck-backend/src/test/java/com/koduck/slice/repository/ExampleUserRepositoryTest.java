package com.koduck.slice.repository;

import com.koduck.config.TestDataFactory;
import com.koduck.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Repository 层切片测试示例
 * 
 * 特点：
 * - 仅加载 Data JPA 层，不加载完整 Spring 上下文
 * - 使用嵌入式或 Testcontainers 数据库
 * - 测试真实数据库交互
 * - 自动回滚事务
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:tc:postgresql:16:///testdb",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@DisplayName("用户仓库切片测试")
@Disabled("示例测试，默认不纳入 CI 执行")
class ExampleUserRepositoryTest {
    
    @Autowired
    private TestEntityManager entityManager;
    
    @Autowired
    private UserRepository userRepository;
    
    @BeforeEach
    void setUp() {
        TestDataFactory.resetIdCounter();
    }
    
    @Test
    @DisplayName("保存用户 - 应返回带ID的用户")
    void save_ShouldReturnUserWithId() {
        // Given
        User user = TestDataFactory.createUser();
        user.setId(null); // 确保是新建
        
        // When
        User savedUser = userRepository.save(user);
        
        // Then
        assertThat(savedUser.getId()).isNotNull();
        assertThat(savedUser.getUsername()).isEqualTo(user.getUsername());
    }
    
    @Test
    @DisplayName("根据用户名查询 - 用户存在时应返回用户")
    void findByUsername_WhenExists_ShouldReturnUser() {
        // Given
        User user = TestDataFactory.createUser("uniqueuser");
        entityManager.persist(user);
        entityManager.flush();
        
        // When
        Optional<User> found = userRepository.findByUsername("uniqueuser");
        
        // Then
        assertThat(found).isPresent();
        assertThat(found.get().getUsername()).isEqualTo("uniqueuser");
    }
    
    @Test
    @DisplayName("根据用户名查询 - 用户不存在时应返回空")
    void findByUsername_WhenNotExists_ShouldReturnEmpty() {
        // When
        Optional<User> found = userRepository.findByUsername("nonexistent");
        
        // Then
        assertThat(found).isEmpty();
    }
    
    @Test
    @DisplayName("检查用户名是否存在 - 应返回正确结果")
    void existsByUsername_ShouldReturnCorrectResult() {
        // Given
        User user = TestDataFactory.createUser("existinguser");
        entityManager.persist(user);
        entityManager.flush();
        
        // When & Then
        assertThat(userRepository.existsByUsername("existinguser")).isTrue();
        assertThat(userRepository.existsByUsername("nonexistent")).isFalse();
    }
}

// 简化的 Repository 接口用于测试编译
interface UserRepository extends org.springframework.data.jpa.repository.JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
}
