package com.koduck.repository.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.koduck.entity.user.UserMemoryProfile;

/**
 * 用户记忆档案实体操作仓库。
 *
 * @author Koduck Team
 */
@Repository
public interface UserMemoryProfileRepository extends JpaRepository<UserMemoryProfile, Long> {
}
