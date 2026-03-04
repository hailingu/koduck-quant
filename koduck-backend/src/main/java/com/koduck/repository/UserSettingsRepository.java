package com.koduck.repository;

import com.koduck.entity.UserSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * 用户设置 Repository
 */
@Repository
public interface UserSettingsRepository extends JpaRepository<UserSettings, Long> {

    /**
     * 根据用户ID查找设置
     */
    Optional<UserSettings> findByUserId(Long userId);

    /**
     * 检查用户是否已有设置
     */
    boolean existsByUserId(Long userId);

    /**
     * 删除用户设置
     */
    void deleteByUserId(Long userId);
}
