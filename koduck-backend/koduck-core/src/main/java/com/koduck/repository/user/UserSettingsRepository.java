package com.koduck.repository.user;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.user.UserSettings;

/**
 * 用户设置操作仓库，提供用户设置数据的数据库访问。
 *
 * @author Koduck Team
 */
@Repository
public interface UserSettingsRepository extends JpaRepository<UserSettings, Long> {

    /**
     * 根据用户 ID 查询用户设置。
     *
     * @param userId 用户 ID
     * @return 用户设置
     */
    Optional<UserSettings> findByUserId(Long userId);

    /**
     * 根据用户 ID 检查用户设置是否存在。
     *
     * @param userId 用户 ID
     * @return 如果存在返回 true，否则返回 false
     */
    boolean existsByUserId(Long userId);

    /**
     * 根据用户 ID 删除用户设置。
     *
     * @param userId 用户 ID
     */
    void deleteByUserId(Long userId);
}
