package com.koduck.repository.credential;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.koduck.entity.auth.UserCredential;

/**
 * 用户凭证仓库，提供用户凭证数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface CredentialRepository extends JpaRepository<UserCredential, Long> {

    /**
     * 根据用户 ID 查询凭证。
     *
     * @param userId 用户 ID
     * @return 凭证列表
     */
    List<UserCredential> findByUserId(Long userId);

    /**
     * 根据用户 ID 和类型查询凭证。
     *
     * @param userId 用户 ID
     * @param type 凭证类型
     * @return 凭证列表
     */
    List<UserCredential> findByUserIdAndType(Long userId, UserCredential.CredentialType type);

    /**
     * 根据用户 ID 和提供商查询凭证。
     *
     * @param userId 用户 ID
     * @param provider 提供商名称
     * @return 凭证列表
     */
    List<UserCredential> findByUserIdAndProvider(Long userId, String provider);

    /**
     * 根据 ID 和用户 ID 查询凭证。
     *
     * @param id 凭证 ID
     * @param userId 用户 ID
     * @return 凭证
     */
    Optional<UserCredential> findByIdAndUserId(Long id, Long userId);

    /**
     * 根据用户 ID 和名称检查凭证是否存在。
     *
     * @param userId 用户 ID
     * @param name 凭证名称
     * @return 如果存在返回 true，否则返回 false
     */
    boolean existsByUserIdAndName(Long userId, String name);

    /**
     * 根据用户 ID 统计凭证数量。
     *
     * @param userId 用户 ID
     * @return 凭证数量
     */
    long countByUserId(Long userId);

    /**
     * 根据用户 ID 和提供商统计凭证数量。
     *
     * @param userId 用户 ID
     * @param provider 提供商名称
     * @return 凭证数量
     */
    @Query("SELECT COUNT(c) FROM UserCredential c WHERE c.userId = :userId AND c.provider = :provider")
    long countByUserIdAndProvider(@Param("userId") Long userId, @Param("provider") String provider);

    /**
     * 根据用户 ID 和类型统计凭证数量。
     *
     * @param userId 用户 ID
     * @param type 凭证类型
     * @return 凭证数量
     */
    long countByUserIdAndType(Long userId, UserCredential.CredentialType type);

    /**
     * 根据用户 ID 删除凭证。
     *
     * @param userId 用户 ID
     */
    void deleteByUserId(Long userId);
}
