package com.koduck.repository;

import com.koduck.entity.UserCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 用户凭证 Repository
 */
@Repository
public interface CredentialRepository extends JpaRepository<UserCredential, Long> {

    /**
     * 根据用户 ID 查询所有凭证
     */
    List<UserCredential> findByUserId(Long userId);

    /**
     * 根据用户 ID 和凭证类型查询
     */
    List<UserCredential> findByUserIdAndType(Long userId, UserCredential.CredentialType type);

    /**
     * 根据用户 ID 和提供商查询
     */
    List<UserCredential> findByUserIdAndProvider(Long userId, String provider);

    /**
     * 根据用户 ID 和凭证 ID 查询
     */
    Optional<UserCredential> findByIdAndUserId(Long id, Long userId);

    /**
     * 检查用户是否已存在指定名称的凭证
     */
    boolean existsByUserIdAndName(Long userId, String name);

    /**
     * 统计用户的凭证数量
     */
    long countByUserId(Long userId);

    /**
     * 根据用户 ID 和提供商统计凭证数量
     */
    @Query("SELECT COUNT(c) FROM UserCredential c WHERE c.userId = :userId AND c.provider = :provider")
    long countByUserIdAndProvider(@Param("userId") Long userId, @Param("provider") String provider);

    /**
     * 根据用户 ID 和凭证类型统计凭证数量
     */
    long countByUserIdAndType(Long userId, UserCredential.CredentialType type);

    /**
     * 删除用户的所有凭证
     */
    void deleteByUserId(Long userId);
}
